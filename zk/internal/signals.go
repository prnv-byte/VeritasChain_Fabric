// Package signals provides shared ZK utilities: float scaling, canonical
// byte serialization for hashing, and per-column stat computation.
//
// Nothing here is hardcoded to a specific parameter list or row count.
// All dimensions are passed in by the caller at runtime — determined by
// whatever the OEM entered in their requirements form.
package signals

import (
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"math"
	"math/big"
)

// Scale is the fixed 1000x factor applied to every float QC value before it
// enters the field. A raw value v is represented in-circuit as round(v*Scale).
const Scale = 1000

// ScaleFloat converts a raw float QC value to its scaled integer representation.
func ScaleFloat(f float64) int64 {
	return int64(math.Round(f * Scale))
}

// UnscaleInt converts a scaled integer back to its human float value.
func UnscaleInt(i int64) float64 {
	return float64(i) / float64(Scale)
}

// ColStats holds the four scaled-integer statistics for one parameter column.
type ColStats struct {
	MeanS   int64
	MinS    int64
	MaxS    int64
	StdDevS int64
}

// CanonicalBytes produces the row-major big-endian serialization used for
// the content hash. scaled is indexed [row][param]; every value is emitted
// as a 4-byte big-endian uint32.
func CanonicalBytes(scaled [][]int64) ([]byte, error) {
	if len(scaled) == 0 {
		return nil, fmt.Errorf("no rows")
	}
	numParams := len(scaled[0])
	buf := make([]byte, 0, len(scaled)*numParams*4)
	for r, row := range scaled {
		if len(row) != numParams {
			return nil, fmt.Errorf("row %d has %d params, expected %d", r, len(row), numParams)
		}
		for _, v := range row {
			if v < 0 || v > math.MaxUint32 {
				return nil, fmt.Errorf("row %d value %d out of uint32 range", r, v)
			}
			var b [4]byte
			binary.BigEndian.PutUint32(b[:], uint32(v))
			buf = append(buf, b[:]...)
		}
	}
	return buf, nil
}

// CanonicalHash returns the SHA-256 of the canonical serialization, split into
// high and low 128-bit limbs (hash_hi, hash_lo).
func CanonicalHash(scaled [][]int64) (hi, lo *big.Int, err error) {
	b, err := CanonicalBytes(scaled)
	if err != nil {
		return nil, nil, err
	}
	sum := sha256.Sum256(b)
	hi = new(big.Int).SetBytes(sum[0:16])
	lo = new(big.Int).SetBytes(sum[16:32])
	return hi, lo, nil
}

// ComputeColStats derives the four scaled-integer statistics for a single
// column of already-scaled values using big.Int arithmetic to avoid overflow.
func ComputeColStats(scaled []int64) (ColStats, error) {
	n := int64(len(scaled))
	if n == 0 {
		return ColStats{}, fmt.Errorf("cannot compute stats over an empty column")
	}

	sum1 := new(big.Int)
	sum2 := new(big.Int)
	minV := scaled[0]
	maxV := scaled[0]

	for _, v := range scaled {
		bv := big.NewInt(v)
		sum1.Add(sum1, bv)
		sum2.Add(sum2, new(big.Int).Mul(bv, bv))
		if v < minV {
			minV = v
		}
		if v > maxV {
			maxV = v
		}
	}

	bn := big.NewInt(n)
	mean := new(big.Int).Quo(sum1, bn)

	d := new(big.Int).Mul(bn, sum2)
	d.Sub(d, new(big.Int).Mul(sum1, sum1))
	if d.Sign() < 0 {
		return ColStats{}, fmt.Errorf("variance numerator went negative (D=%s)", d.String())
	}

	sqrtD := new(big.Int).Sqrt(d)
	stddev := new(big.Int).Quo(sqrtD, bn)

	return ColStats{
		MeanS:   mean.Int64(),
		MinS:    minV,
		MaxS:    maxV,
		StdDevS: stddev.Int64(),
	}, nil
}
