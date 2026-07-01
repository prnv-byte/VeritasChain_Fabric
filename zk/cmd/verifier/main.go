// Command vc-quickverify checks a proof produced by vc-quickprove.
//
// Usage:
//
//	vc-quickverify --proof ORD-001.proof --public ORD-001.public.json --vk ORD-001.vk
//
// Exit codes: 0 = PROOF VALID, 2 = PROOF INVALID, 1 = error.
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"math/big"
	"os"
	"text/tabwriter"

	"github.com/consensys/gnark/backend/groth16"
	"github.com/consensys/gnark/frontend"

	"github.com/veritaschain/zk/circuits"
)

const scale = 1000

func main() {
	proofPath  := flag.String("proof", "", "path to the .proof file")
	publicPath := flag.String("public", "", "path to the .public.json file")
	vkPath     := flag.String("vk", "", "path to the .vk file")
	flag.Parse()

	if *proofPath == "" || *publicPath == "" || *vkPath == "" {
		fmt.Fprintln(os.Stderr, "vc-quickverify: --proof, --public and --vk are all required")
		os.Exit(1)
	}

	valid, err := run(*proofPath, *publicPath, *vkPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, "vc-quickverify: "+err.Error())
		os.Exit(1)
	}
	if !valid {
		os.Exit(2)
	}
}

type publicArtifact struct {
	Order      string                        `json:"order"`
	Columns    []string                      `json:"columns"`
	BatchSize  int64                         `json:"batch_size"`
	HashHi     string                        `json:"hash_hi"`
	HashLo     string                        `json:"hash_lo"`
	Parameters map[string]map[string]float64 `json:"parameters"`
}

func run(proofPath, publicPath, vkPath string) (bool, error) {
	// load public.json
	data, err := os.ReadFile(publicPath)
	if err != nil {
		return false, fmt.Errorf("read public.json: %w", err)
	}
	var art publicArtifact
	if err := json.Unmarshal(data, &art); err != nil {
		return false, fmt.Errorf("parse public.json: %w", err)
	}

	// rebuild FlexPublicSignals from the artifact
	hi, ok1 := new(big.Int).SetString(art.HashHi, 10)
	lo, ok2 := new(big.Int).SetString(art.HashLo, 10)
	if !ok1 || !ok2 {
		return false, fmt.Errorf("public.json has invalid hash_hi/hash_lo")
	}

	ps := &circuits.FlexPublicSignals{
		Params:    art.Columns,
		BatchSize: art.BatchSize,
		HashHi:    hi,
		HashLo:    lo,
		Stats:     make([]circuits.FlexColStats, len(art.Columns)),
	}
	for i, col := range art.Columns {
		s, ok := art.Parameters[col]
		if !ok {
			return false, fmt.Errorf("public.json missing stats for column %q", col)
		}
		ps.Stats[i] = circuits.FlexColStats{
			MeanS:   int64(s["mean"] * scale),
			MinS:    int64(s["min"]  * scale),
			MaxS:    int64(s["max"]  * scale),
			StdDevS: int64(s["stddev"] * scale),
		}
	}

	// load vk
	vkData, err := os.ReadFile(vkPath)
	if err != nil {
		return false, fmt.Errorf("read vk: %w", err)
	}
	vk := groth16.NewVerifyingKey(circuits.Curve)
	if _, err := vk.ReadFrom(bytes.NewReader(vkData)); err != nil {
		return false, fmt.Errorf("parse vk: %w", err)
	}

	// load proof
	proofData, err := os.ReadFile(proofPath)
	if err != nil {
		return false, fmt.Errorf("read proof: %w", err)
	}
	proof := groth16.NewProof(circuits.Curve)
	if _, err := proof.ReadFrom(bytes.NewReader(proofData)); err != nil {
		return false, fmt.Errorf("parse proof: %w", err)
	}

	// build public witness and verify
	pubWitness, err := frontend.NewWitness(
		circuits.AssignFlexPublic(ps),
		circuits.Curve.ScalarField(),
		frontend.PublicOnly(),
	)
	if err != nil {
		return false, fmt.Errorf("build public witness: %w", err)
	}

	if err := groth16.Verify(proof, vk, pubWitness); err != nil {
		fmt.Println("PROOF INVALID")
		return false, nil
	}

	fmt.Println("PROOF VALID")
	printTable(art)
	return true, nil
}

func printTable(art publicArtifact) {
	fmt.Printf("order:      %s\n", art.Order)
	fmt.Printf("batch size: %d\n", art.BatchSize)
	fmt.Println()
	tw := tabwriter.NewWriter(os.Stdout, 0, 4, 2, ' ', 0)
	fmt.Fprintln(tw, "column\tmean\tmin\tmax\tstddev")
	fmt.Fprintln(tw, "------\t----\t---\t---\t------")
	for _, col := range art.Columns {
		s := art.Parameters[col]
		fmt.Fprintf(tw, "%s\t%g\t%g\t%g\t%g\n", col, s["mean"], s["min"], s["max"], s["stddev"])
	}
	tw.Flush()
}
