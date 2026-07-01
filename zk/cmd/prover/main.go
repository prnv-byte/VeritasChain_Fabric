// Command vc-quickprove generates a ZK proof from any CSV file.
//
// Usage (with OEM-provided proving key — recommended):
//
//	vc-quickprove --csv data.csv --order ORD-001 --out ./out/ --pk circuit.pk
//
// Outputs:
//
//	out/ORD-001.proof       — the Groth16 proof
//	out/ORD-001.public.json — public inputs (column stats + hash)
package main

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/csv"
	"encoding/json"
	"flag"
	"fmt"
	"math"
	"math/big"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/consensys/gnark/backend/groth16"
	"github.com/consensys/gnark/frontend"

	"github.com/veritaschain/zk/circuits"
)

const scale = 1000

func main() {
	csvPath := flag.String("csv", "", "path to QC CSV file")
	order   := flag.String("order", "", "order identifier (names the output files)")
	outDir  := flag.String("out", ".", "output directory")
	pkFile  := flag.String("pk", "", "path to circuit.pk (proving key from OEM via platform)")
	flag.Parse()

	if *csvPath == "" || *order == "" {
		fmt.Fprintln(os.Stderr, "vc-quickprove: --csv and --order are required")
		os.Exit(1)
	}
	if *pkFile == "" {
		fmt.Fprintln(os.Stderr, "vc-quickprove: --pk is required (download circuit.pk from the platform Requirements page)")
		os.Exit(1)
	}

	if err := run(*csvPath, *order, *outDir, *pkFile); err != nil {
		fmt.Fprintln(os.Stderr, "vc-quickprove: "+err.Error())
		os.Exit(2)
	}
}

func run(csvPath, order, outDir, pkFile string) error {
	fmt.Println("Reading CSV...")
	params, scaled, err := readCSV(csvPath)
	if err != nil {
		return err
	}
	rows      := len(scaled)
	numParams := len(params)
	fmt.Printf("  columns : %s\n", strings.Join(params, ", "))
	fmt.Printf("  rows    : %d\n", rows)

	fmt.Println("Computing public signals...")
	ps, err := buildPublicSignals(params, scaled)
	if err != nil {
		return err
	}

	fmt.Printf("Compiling circuit (%d rows × %d params)...\n", rows, numParams)
	ccs, err := circuits.CompileFlexCircuit(rows, numParams)
	if err != nil {
		return err
	}
	fmt.Printf("  constraints: %d\n", ccs.GetNbConstraints())

	fmt.Printf("Loading proving key from %s...\n", pkFile)
	pk := groth16.NewProvingKey(circuits.Curve)
	pkF, err := os.Open(pkFile)
	if err != nil {
		return fmt.Errorf("open circuit.pk: %w", err)
	}
	if _, err := pk.ReadFrom(pkF); err != nil {
		pkF.Close()
		return fmt.Errorf("read circuit.pk: %w", err)
	}
	pkF.Close()

	fmt.Println("Generating proof...")
	assignment, err := circuits.AssignFlexFull(scaled, ps)
	if err != nil {
		return err
	}
	fullWitness, err := frontend.NewWitness(assignment, circuits.Curve.ScalarField())
	if err != nil {
		return fmt.Errorf("build witness: %w", err)
	}
	proof, err := groth16.Prove(ccs, pk, fullWitness)
	if err != nil {
		return fmt.Errorf("prove: %w", err)
	}

	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return fmt.Errorf("create output dir: %w", err)
	}

	proofPath := filepath.Join(outDir, order+".proof")
	pf, err := os.Create(proofPath)
	if err != nil {
		return fmt.Errorf("create proof file: %w", err)
	}
	if _, err := proof.WriteTo(pf); err != nil {
		pf.Close()
		return fmt.Errorf("write proof: %w", err)
	}
	pf.Close()

	if err := writePublicJSON(outDir, order, ps); err != nil {
		return err
	}

	fmt.Printf("\nDone. Files written to %s/\n", outDir)
	fmt.Printf("  %s.proof\n", order)
	fmt.Printf("  %s.public.json\n", order)
	fmt.Println("\nUpload both files to the platform to fulfill the order.")
	return nil
}

func readCSV(path string) ([]string, [][]int64, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, nil, fmt.Errorf("open csv: %w", err)
	}
	defer f.Close()

	records, err := csv.NewReader(f).ReadAll()
	if err != nil {
		return nil, nil, fmt.Errorf("parse csv: %w", err)
	}
	if len(records) < 2 {
		return nil, nil, fmt.Errorf("csv has no data rows")
	}

	header := records[0]
	data   := records[1:]

	var numericCols []int
	var paramNames  []string
	for col, name := range header {
		allNumeric := true
		for _, row := range data {
			if col >= len(row) { allNumeric = false; break }
			if _, err := strconv.ParseFloat(strings.TrimSpace(row[col]), 64); err != nil {
				allNumeric = false; break
			}
		}
		if allNumeric {
			numericCols = append(numericCols, col)
			paramNames  = append(paramNames, strings.TrimSpace(name))
		}
	}
	if len(numericCols) == 0 {
		return nil, nil, fmt.Errorf("csv has no numeric columns")
	}

	scaled := make([][]int64, len(data))
	for r, rec := range data {
		row := make([]int64, len(numericCols))
		for i, col := range numericCols {
			fv, _ := strconv.ParseFloat(strings.TrimSpace(rec[col]), 64)
			s := int64(math.Round(fv * scale))
			if s < 0 || s > math.MaxUint32 {
				return nil, nil, fmt.Errorf("row %d col %q: scaled value %d out of uint32 range", r+1, paramNames[i], s)
			}
			row[i] = s
		}
		scaled[r] = row
	}
	return paramNames, scaled, nil
}

func buildPublicSignals(params []string, scaled [][]int64) (*circuits.FlexPublicSignals, error) {
	rows      := len(scaled)
	numParams := len(params)

	buf := make([]byte, 0, rows*numParams*4)
	for _, row := range scaled {
		for _, v := range row {
			var b [4]byte
			binary.BigEndian.PutUint32(b[:], uint32(v))
			buf = append(buf, b[:]...)
		}
	}
	sum := sha256.Sum256(buf)
	hi  := new(big.Int).SetBytes(sum[0:16])
	lo  := new(big.Int).SetBytes(sum[16:32])

	stats := make([]circuits.FlexColStats, numParams)
	for p := 0; p < numParams; p++ {
		col := make([]int64, rows)
		for r := range scaled { col[r] = scaled[r][p] }
		cs, err := colStats(col)
		if err != nil {
			return nil, fmt.Errorf("column %q: %w", params[p], err)
		}
		stats[p] = cs
	}

	return &circuits.FlexPublicSignals{
		Params:    params,
		HashHi:    hi,
		HashLo:    lo,
		BatchSize: int64(rows),
		Stats:     stats,
	}, nil
}

func colStats(col []int64) (circuits.FlexColStats, error) {
	n := int64(len(col))
	if n == 0 { return circuits.FlexColStats{}, fmt.Errorf("empty column") }
	sum1 := new(big.Int)
	sum2 := new(big.Int)
	minV := col[0]
	maxV := col[0]
	for _, v := range col {
		bv := big.NewInt(v)
		sum1.Add(sum1, bv)
		sum2.Add(sum2, new(big.Int).Mul(bv, bv))
		if v < minV { minV = v }
		if v > maxV { maxV = v }
	}
	bn     := big.NewInt(n)
	mean   := new(big.Int).Quo(sum1, bn)
	d      := new(big.Int).Mul(bn, sum2)
	d.Sub(d, new(big.Int).Mul(sum1, sum1))
	if d.Sign() < 0 { return circuits.FlexColStats{}, fmt.Errorf("variance negative (bug)") }
	stddev := new(big.Int).Quo(new(big.Int).Sqrt(d), bn)
	return circuits.FlexColStats{
		MeanS:   mean.Int64(),
		MinS:    minV,
		MaxS:    maxV,
		StdDevS: stddev.Int64(),
	}, nil
}

type publicArtifact struct {
	Order      string                        `json:"order"`
	Columns    []string                      `json:"columns"`
	BatchSize  int64                         `json:"batch_size"`
	HashHi     string                        `json:"hash_hi"`
	HashLo     string                        `json:"hash_lo"`
	Parameters map[string]map[string]float64 `json:"parameters"`
}

func writePublicJSON(outDir, order string, ps *circuits.FlexPublicSignals) error {
	params := make(map[string]map[string]float64, len(ps.Params))
	for i, name := range ps.Params {
		params[name] = map[string]float64{
			"mean":   float64(ps.Stats[i].MeanS) / scale,
			"min":    float64(ps.Stats[i].MinS)  / scale,
			"max":    float64(ps.Stats[i].MaxS)  / scale,
			"stddev": float64(ps.Stats[i].StdDevS) / scale,
		}
	}
	art := publicArtifact{
		Order:     order,
		Columns:   ps.Params,
		BatchSize: ps.BatchSize,
		HashHi:    ps.HashHi.String(),
		HashLo:    ps.HashLo.String(),
		Parameters: params,
	}
	data, err := json.MarshalIndent(art, "", "  ")
	if err != nil {
		return fmt.Errorf("encode public.json: %w", err)
	}
	return os.WriteFile(filepath.Join(outDir, order+".public.json"), data, 0o644)
}
