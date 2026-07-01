// Command vc-setup runs the Groth16 trusted setup for a flex QC circuit and
// writes the proving key, verifying key, and requirements metadata to the output directory.
//
// Usage:
//
//	vc-setup --params voltage,capacity,weight --rows 500 --out ./keys/
//	vc-setup --params voltage,capacity,weight --rows 500 --mins 3.5,100,10 --maxs 4.2,200,50 --out ./keys/
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/consensys/gnark/backend/groth16"

	"github.com/veritaschain/zk/circuits"
)

// RequirementsMetadata is written alongside the keys so the verifier and prover
// can read the OEM's range constraints without needing the backend.
type RequirementsMetadata struct {
	Params []ParamMeta `json:"params"`
	Rows   int         `json:"rows"`
}

type ParamMeta struct {
	Name string `json:"name"`
	Min  string `json:"min,omitempty"`
	Max  string `json:"max,omitempty"`
}

func main() {
	params := flag.String("params", "", "comma-separated parameter names (e.g. voltage,capacity,weight)")
	rows   := flag.Int("rows", 500, "number of QC rows the supplier will prove per batch")
	mins   := flag.String("mins", "", "comma-separated minimum values per parameter (same order as --params)")
	maxs   := flag.String("maxs", "", "comma-separated maximum values per parameter (same order as --params)")
	outDir := flag.String("out", "keys", "directory to write circuit.pk, circuit.vk, and requirements.json")
	flag.Parse()

	if *params == "" {
		fmt.Fprintln(os.Stderr, "vc-setup: --params is required")
		os.Exit(1)
	}

	paramList := splitTrim(*params)
	minList   := splitTrim(*mins)
	maxList   := splitTrim(*maxs)

	if err := run(paramList, minList, maxList, *rows, *outDir); err != nil {
		fmt.Fprintln(os.Stderr, "vc-setup: "+err.Error())
		os.Exit(1)
	}
}

func splitTrim(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	for i, p := range parts {
		parts[i] = strings.TrimSpace(p)
	}
	return parts
}

func run(params, mins, maxs []string, rows int, outDir string) error {
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return fmt.Errorf("create output dir: %w", err)
	}

	fmt.Printf("Parameters : %s\n", strings.Join(params, ", "))
	fmt.Printf("Rows       : %d\n", rows)
	if len(mins) > 0 {
		fmt.Printf("Min bounds : %s\n", strings.Join(mins, ", "))
	}
	if len(maxs) > 0 {
		fmt.Printf("Max bounds : %s\n", strings.Join(maxs, ", "))
	}
	fmt.Printf("Circuit    : %d params × %d rows\n\n", len(params), rows)

	// Write requirements metadata so prover/verifier can read OEM constraints
	meta := RequirementsMetadata{Rows: rows}
	for i, p := range params {
		pm := ParamMeta{Name: p}
		if i < len(mins) { pm.Min = mins[i] }
		if i < len(maxs) { pm.Max = maxs[i] }
		meta.Params = append(meta.Params, pm)
	}
	metaBytes, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal requirements: %w", err)
	}
	if err := os.WriteFile(filepath.Join(outDir, "requirements.json"), metaBytes, 0o644); err != nil {
		return fmt.Errorf("write requirements.json: %w", err)
	}

	fmt.Println("Compiling circuit...")
	ccs, err := circuits.CompileFlexCircuit(rows, len(params))
	if err != nil {
		return fmt.Errorf("compile circuit: %w", err)
	}
	fmt.Printf("  constraints: %d\n\n", ccs.GetNbConstraints())

	fmt.Println("Running Groth16 trusted setup (this may take several minutes)...")
	pk, vk, err := groth16.Setup(ccs)
	if err != nil {
		return fmt.Errorf("trusted setup: %w", err)
	}

	pkPath := filepath.Join(outDir, "circuit.pk")
	pkFile, err := os.Create(pkPath)
	if err != nil {
		return fmt.Errorf("create pk file: %w", err)
	}
	if _, err := pk.WriteTo(pkFile); err != nil {
		pkFile.Close()
		return fmt.Errorf("write pk: %w", err)
	}
	pkFile.Close()

	vkPath := filepath.Join(outDir, "circuit.vk")
	vkFile, err := os.Create(vkPath)
	if err != nil {
		return fmt.Errorf("create vk file: %w", err)
	}
	if _, err := vk.WriteTo(vkFile); err != nil {
		vkFile.Close()
		return fmt.Errorf("write vk: %w", err)
	}
	vkFile.Close()

	fmt.Printf("\nDone.\n")
	fmt.Printf("  wrote %s\n", filepath.Join(outDir, "requirements.json"))
	fmt.Printf("  wrote %s  ← share with supplier via platform\n", pkPath)
	fmt.Printf("  wrote %s  ← kept on server for verification\n", vkPath)
	return nil
}
