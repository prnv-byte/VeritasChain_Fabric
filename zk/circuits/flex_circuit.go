// Package circuits — flex_circuit.go
//
// FlexCircuit accepts any number of parameters (columns) and any batch size
// (rows), determined at runtime from the OEM's requirements form. Nothing is
// hardcoded to specific parameter names or row counts.
//
// The proven statements:
//  1. The private values hash to the public csv_hash_hi / csv_hash_lo.
//  2. The public per-column statistics are correctly derived from those values.
package circuits

import (
	"errors"
	"math/big"

	"github.com/consensys/gnark-crypto/ecc"
	"github.com/consensys/gnark/constraint"
	"github.com/consensys/gnark/frontend"
	"github.com/consensys/gnark/frontend/cs/r1cs"
	"github.com/consensys/gnark/std/hash/sha2"
	"github.com/consensys/gnark/std/math/cmp"
	"github.com/consensys/gnark/std/math/uints"
)

// Curve is the elliptic curve used across the whole ZK system.
const Curve = ecc.BN254

// CircuitVersion identifies the circuit shape written into public.json.
const CircuitVersion = "flex-v1"

// packBigEndian folds a big-endian byte slice into a single field element.
func packBigEndian(api frontend.API, bytes []uints.U8) frontend.Variable {
	var acc frontend.Variable = 0
	for _, b := range bytes {
		acc = api.Add(api.Mul(acc, 256), b.Val)
	}
	return acc
}

// lsh returns 1<<bits as a *big.Int, used for comparator bounds.
func lsh(bits uint) *big.Int {
	return new(big.Int).Lsh(big.NewInt(1), bits)
}

// FlexCircuit proves the same QC statements as QCCircuit but for arbitrary
// (rows, numParams) fixed at instantiation time.
type FlexCircuit struct {
	// Private
	Values  [][]frontend.Variable // [rows][numParams]
	MeanRem []frontend.Variable   // [numParams]

	// Public
	HashHi    frontend.Variable   `gnark:",public"`
	HashLo    frontend.Variable   `gnark:",public"`
	BatchSize frontend.Variable   `gnark:",public"`
	Stats     [][]frontend.Variable `gnark:",public"` // [numParams][4]: mean, min, max, stddev
}

// NewFlexCircuit allocates a FlexCircuit for the given dimensions.
// Call this both for circuit compilation and for building witnesses.
func NewFlexCircuit(rows, numParams int) *FlexCircuit {
	c := &FlexCircuit{
		Values:  make([][]frontend.Variable, rows),
		MeanRem: make([]frontend.Variable, numParams),
		Stats:   make([][]frontend.Variable, numParams),
	}
	for r := range c.Values {
		c.Values[r] = make([]frontend.Variable, numParams)
	}
	for p := range c.Stats {
		c.Stats[p] = make([]frontend.Variable, 4) // mean, min, max, stddev
	}
	return c
}

// Define expresses the constraints — identical logic to QCCircuit.Define.
func (c *FlexCircuit) Define(api frontend.API) error {
	rows := len(c.Values)
	if rows == 0 {
		return errors.New("flex circuit: zero rows")
	}
	numParams := len(c.MeanRem)
	if numParams == 0 {
		return errors.New("flex circuit: zero parameters")
	}

	api.AssertIsEqual(c.BatchSize, rows)

	uapi, err := uints.New[uints.U32](api)
	if err != nil {
		return err
	}
	hasher, err := sha2.New(api)
	if err != nil {
		return err
	}
	for r := 0; r < rows; r++ {
		for p := 0; p < numParams; p++ {
			v := c.Values[r][p]
			u := uapi.ValueOf(v)
			api.AssertIsEqual(uapi.ToValue(u), v)
			hasher.Write(uapi.UnpackMSB(u))
		}
	}
	digest := hasher.Sum()
	api.AssertIsEqual(packBigEndian(api, digest[0:16]), c.HashHi)
	api.AssertIsEqual(packBigEndian(api, digest[16:32]), c.HashLo)

	valCmp := cmp.NewBoundedComparator(api, lsh(34), false)
	remCmp := cmp.NewBoundedComparator(api, lsh(20), false)
	bigCmp := cmp.NewBoundedComparator(api, lsh(66), false)

	for p := 0; p < numParams; p++ {
		mean   := c.Stats[p][0]
		minV   := c.Stats[p][1]
		maxV   := c.Stats[p][2]
		stddev := c.Stats[p][3]

		var sum1 frontend.Variable = 0
		var sum2 frontend.Variable = 0
		var prodMin frontend.Variable = 1
		var prodMax frontend.Variable = 1

		for r := 0; r < rows; r++ {
			v := c.Values[r][p]
			sum1 = api.Add(sum1, v)
			sum2 = api.Add(sum2, api.Mul(v, v))
			valCmp.AssertIsLessEq(minV, v)
			valCmp.AssertIsLessEq(v, maxV)
			prodMin = api.Mul(prodMin, api.Sub(v, minV))
			prodMax = api.Mul(prodMax, api.Sub(maxV, v))
		}
		api.AssertIsEqual(prodMin, 0)
		api.AssertIsEqual(prodMax, 0)

		rem := c.MeanRem[p]
		api.AssertIsEqual(sum1, api.Add(api.Mul(mean, rows), rem))
		remCmp.AssertIsLessEq(0, rem)
		remCmp.AssertIsLess(rem, rows)

		d  := api.Sub(api.Mul(rows, sum2), api.Mul(sum1, sum1))
		kn  := api.Mul(stddev, rows)
		k1n := api.Mul(api.Add(stddev, 1), rows)
		bigCmp.AssertIsLessEq(api.Mul(kn, kn), d)
		bigCmp.AssertIsLess(d, api.Mul(k1n, k1n))
	}
	return nil
}

// CompileFlexCircuit builds the R1CS for the given (rows, numParams).
func CompileFlexCircuit(rows, numParams int) (constraint.ConstraintSystem, error) {
	ccs, err := frontend.Compile(Curve.ScalarField(), r1cs.NewBuilder, NewFlexCircuit(rows, numParams))
	if err != nil {
		return nil, err
	}
	return ccs, nil
}

// FlexPublicSignals carries the structured public outputs for a flex proof.
type FlexPublicSignals struct {
	Params    []string    // column names in order
	HashHi    *big.Int
	HashLo    *big.Int
	BatchSize int64
	Stats     []FlexColStats // one per param, in Params order
}

// FlexColStats holds the four scaled-integer stats for one column.
type FlexColStats struct {
	MeanS   int64
	MinS    int64
	MaxS    int64
	StdDevS int64
}

// AssignFlexFull builds a complete witness from scaled values [row][param].
func AssignFlexFull(scaled [][]int64, ps *FlexPublicSignals) (*FlexCircuit, error) {
	rows := len(scaled)
	if rows == 0 {
		return nil, errors.New("no rows")
	}
	numParams := len(ps.Params)
	c := NewFlexCircuit(rows, numParams)

	for r := 0; r < rows; r++ {
		for p := 0; p < numParams; p++ {
			c.Values[r][p] = scaled[r][p]
		}
	}
	c.HashHi    = new(big.Int).Set(ps.HashHi)
	c.HashLo    = new(big.Int).Set(ps.HashLo)
	c.BatchSize = ps.BatchSize
	for p := 0; p < numParams; p++ {
		c.Stats[p][0] = ps.Stats[p].MeanS
		c.Stats[p][1] = ps.Stats[p].MinS
		c.Stats[p][2] = ps.Stats[p].MaxS
		c.Stats[p][3] = ps.Stats[p].StdDevS
	}

	n := int64(rows)
	for p := 0; p < numParams; p++ {
		var sum1 int64
		for r := 0; r < rows; r++ {
			sum1 += scaled[r][p]
		}
		c.MeanRem[p] = sum1 - ps.Stats[p].MeanS*n
	}
	return c, nil
}

// AssignFlexPublic builds a public-only witness for verification.
func AssignFlexPublic(ps *FlexPublicSignals) *FlexCircuit {
	numParams := len(ps.Params)
	c := NewFlexCircuit(0, numParams)
	c.HashHi    = new(big.Int).Set(ps.HashHi)
	c.HashLo    = new(big.Int).Set(ps.HashLo)
	c.BatchSize = ps.BatchSize
	for p := 0; p < numParams; p++ {
		c.Stats[p][0] = ps.Stats[p].MeanS
		c.Stats[p][1] = ps.Stats[p].MinS
		c.Stats[p][2] = ps.Stats[p].MaxS
		c.Stats[p][3] = ps.Stats[p].StdDevS
	}
	return c
}
