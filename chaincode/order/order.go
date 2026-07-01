package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// ── Status constants ─────────────────────────────────────────────────────────

const (
	StatusPending   = "PENDING"
	StatusFulfilled = "FULFILLED"
	StatusAccepted  = "ACCEPTED"
	StatusRejected  = "REJECTED"
	StatusCancelled = "CANCELLED"
)

// ── Requirements ─────────────────────────────────────────────────────────────

// Requirements is posted by the manufacturer when they join a channel.
// Stored under key "REQ-<manufacturerMSP>" on the channel ledger.
// Supplier reads this to know what to produce and what ZK ranges to prove against.
type Requirements struct {
	ManufacturerMSP    string `json:"manufacturerMSP"`
	ComponentType      string `json:"componentType"`
	GlobalRequirements string `json:"globalRequirements"` // JSON: [{name,value,unit}]
	ZKRanges           string `json:"zkRanges"`           // JSON: [{name,min,max,unit}]
	VerificationKey    string `json:"verificationKey"`    // full verification_key.json content
	SetAt              string `json:"setAt"`
}

// ── Asset Definition ─────────────────────────────────────────────────────────

// Order is the universal asset stored on every channel ledger.
type Order struct {
	// ── Identity ──────────────────────────────────────────────────────────
	OrderID         string `json:"orderID"`
	ManufacturerMSP string `json:"manufacturerMSP"`
	SupplierMSP     string `json:"supplierMSP"`
	ComponentType   string `json:"componentType"`

	// ── Order Details ─────────────────────────────────────────────────────
	Quantity       int    `json:"quantity"`
	Specifications string `json:"specifications"`
	Deadline       string `json:"deadline"`
	Status         string `json:"status"`
	CreatedAt      string `json:"createdAt"`

	// ── Fulfillment (filled by supplier in FulfillOrder) ──────────────────
	BatchID       string `json:"batchID"`
	ZKProof       string `json:"zkProof"`       // full proof.json content from snarkjs
	PublicSignals string `json:"publicSignals"` // full public.json content from snarkjs
	FulfilledAt   string `json:"fulfilledAt"`

	// ── Verification (filled by manufacturer after running ZK verifier) ───
	VerificationResult string `json:"verificationResult"` // "PASS" or "FAIL"
	RejectionReason    string `json:"rejectionReason"`
	VerifiedBy         string `json:"verifiedBy"`
	VerifiedAt         string `json:"verifiedAt"`

	// ── Feedback (filled by manufacturer after decision) ──────────────────
	FeedbackText string `json:"feedbackText"`
	FeedbackAt   string `json:"feedbackAt"`
}

// ── Event Payloads ───────────────────────────────────────────────────────────

type OrderCreatedEvent struct {
	OrderID         string `json:"orderID"`
	ManufacturerMSP string `json:"manufacturerMSP"`
	SupplierMSP     string `json:"supplierMSP"`
	ComponentType   string `json:"componentType"`
	Deadline        string `json:"deadline"`
}

type OrderFulfilledEvent struct {
	OrderID     string `json:"orderID"`
	SupplierMSP string `json:"supplierMSP"`
	FulfilledAt string `json:"fulfilledAt"`
	Deadline    string `json:"deadline"`
}

type OrderDecisionEvent struct {
	OrderID    string `json:"orderID"`
	Status     string `json:"status"`
	VerifiedBy string `json:"verifiedBy"`
	VerifiedAt string `json:"verifiedAt"`
	Reason     string `json:"reason,omitempty"`
}

type FeedbackSubmittedEvent struct {
	OrderID         string `json:"orderID"`
	SupplierMSP     string `json:"supplierMSP"`
	ManufacturerMSP string `json:"manufacturerMSP"`
	FeedbackAt      string `json:"feedbackAt"`
}

type RequirementsUpdatedEvent struct {
	ManufacturerMSP string `json:"manufacturerMSP"`
	ComponentType   string `json:"componentType"`
	UpdatedAt       string `json:"updatedAt"`
}

// ── History ──────────────────────────────────────────────────────────────────

type HistoryRecord struct {
	TxID      string `json:"txID"`
	Timestamp string `json:"timestamp"`
	IsDelete  bool   `json:"isDelete"`
	Value     *Order `json:"value,omitempty"`
}

// ── SmartContract ────────────────────────────────────────────────────────────

type SmartContract struct {
	contractapi.Contract
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// now returns the transaction timestamp — identical on every peer for the same tx.
func now(ctx contractapi.TransactionContextInterface) string {
	ts, err := ctx.GetStub().GetTxTimestamp()
	if err != nil || ts == nil {
		return time.Now().UTC().Format(time.RFC3339)
	}
	return time.Unix(ts.Seconds, int64(ts.Nanos)).UTC().Format(time.RFC3339)
}

func callerMSP(ctx contractapi.TransactionContextInterface) (string, error) {
	mspID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return "", fmt.Errorf("failed to get caller MSP ID: %v", err)
	}
	return mspID, nil
}

func getOrder(ctx contractapi.TransactionContextInterface, orderID string) (*Order, error) {
	data, err := ctx.GetStub().GetState(orderID)
	if err != nil {
		return nil, fmt.Errorf("failed to read order %s: %v", orderID, err)
	}
	if data == nil {
		return nil, fmt.Errorf("order %s does not exist", orderID)
	}
	var order Order
	if err := json.Unmarshal(data, &order); err != nil {
		return nil, fmt.Errorf("failed to deserialise order: %v", err)
	}
	return &order, nil
}

func putOrder(ctx contractapi.TransactionContextInterface, order *Order) error {
	data, err := json.Marshal(order)
	if err != nil {
		return fmt.Errorf("failed to serialise order: %v", err)
	}
	return ctx.GetStub().PutState(order.OrderID, data)
}

func emitEvent(ctx contractapi.TransactionContextInterface, name string, payload interface{}) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal %s event: %v", name, err)
	}
	return ctx.GetStub().SetEvent(name, data)
}

// ── Requirements Functions ───────────────────────────────────────────────────

// SetRequirements is called by the manufacturer to post their component requirements
// on the channel ledger. Can be called again to update — each update is timestamped.
// Supplier reads these to know what specs to target and what ZK ranges to prove against.
func (s *SmartContract) SetRequirements(
	ctx contractapi.TransactionContextInterface,
	componentType string,
	globalRequirements string,
	zkRanges string,
	verificationKey string,
) error {
	msp, err := callerMSP(ctx)
	if err != nil {
		return err
	}
	if componentType == "" {
		return fmt.Errorf("componentType cannot be empty")
	}
	if globalRequirements == "" {
		return fmt.Errorf("globalRequirements cannot be empty")
	}
	if zkRanges == "" {
		return fmt.Errorf("zkRanges cannot be empty")
	}
	if verificationKey == "" {
		return fmt.Errorf("verificationKey cannot be empty")
	}

	req := &Requirements{
		ManufacturerMSP:    msp,
		ComponentType:      componentType,
		GlobalRequirements: globalRequirements,
		ZKRanges:           zkRanges,
		VerificationKey:    verificationKey,
		SetAt:              now(ctx),
	}

	data, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("failed to serialise requirements: %v", err)
	}

	key := fmt.Sprintf("REQ-%s", msp)
	if err := ctx.GetStub().PutState(key, data); err != nil {
		return err
	}

	return emitEvent(ctx, "RequirementsUpdated", RequirementsUpdatedEvent{
		ManufacturerMSP: msp,
		ComponentType:   componentType,
		UpdatedAt:       req.SetAt,
	})
}

// GetRequirements returns the manufacturer's posted requirements.
// Any channel member including the supplier can call this.
func (s *SmartContract) GetRequirements(
	ctx contractapi.TransactionContextInterface,
	manufacturerMSP string,
) (*Requirements, error) {
	if manufacturerMSP == "" {
		return nil, fmt.Errorf("manufacturerMSP cannot be empty")
	}
	key := fmt.Sprintf("REQ-%s", manufacturerMSP)
	data, err := ctx.GetStub().GetState(key)
	if err != nil {
		return nil, fmt.Errorf("failed to read requirements: %v", err)
	}
	if data == nil {
		return nil, fmt.Errorf("no requirements set yet for %s", manufacturerMSP)
	}
	var req Requirements
	if err := json.Unmarshal(data, &req); err != nil {
		return nil, fmt.Errorf("failed to deserialise requirements: %v", err)
	}
	return &req, nil
}

// ── Order Write Functions ────────────────────────────────────────────────────

// CreateOrder is called by a manufacturer to raise a new component order.
func (s *SmartContract) CreateOrder(
	ctx contractapi.TransactionContextInterface,
	orderID string,
	quantity int,
	componentType string,
	specifications string,
	supplierMSP string,
	deadline string,
) error {
	msp, err := callerMSP(ctx)
	if err != nil {
		return err
	}
	if orderID == "" {
		return fmt.Errorf("orderID cannot be empty")
	}
	if quantity <= 0 {
		return fmt.Errorf("quantity must be greater than 0")
	}
	if componentType == "" {
		return fmt.Errorf("componentType cannot be empty")
	}
	if supplierMSP == "" {
		return fmt.Errorf("supplierMSP cannot be empty")
	}
	if deadline == "" {
		return fmt.Errorf("deadline cannot be empty")
	}

	existing, _ := ctx.GetStub().GetState(orderID)
	if existing != nil {
		return fmt.Errorf("order %s already exists", orderID)
	}

	order := &Order{
		OrderID:         orderID,
		ManufacturerMSP: msp,
		SupplierMSP:     supplierMSP,
		ComponentType:   componentType,
		Quantity:        quantity,
		Specifications:  specifications,
		Deadline:        deadline,
		Status:          StatusPending,
		CreatedAt:       now(ctx),
	}

	if err := putOrder(ctx, order); err != nil {
		return err
	}

	return emitEvent(ctx, "OrderCreated", OrderCreatedEvent{
		OrderID:         order.OrderID,
		ManufacturerMSP: order.ManufacturerMSP,
		SupplierMSP:     order.SupplierMSP,
		ComponentType:   order.ComponentType,
		Deadline:        order.Deadline,
	})
}

// FulfillOrder is called by the supplier after generating a ZK proof with snarkjs.
// Submits proof.json and public.json file contents directly on chain — no S3 needed.
func (s *SmartContract) FulfillOrder(
	ctx contractapi.TransactionContextInterface,
	orderID string,
	batchID string,
	zkProof string,
	publicSignals string,
) error {
	msp, err := callerMSP(ctx)
	if err != nil {
		return err
	}

	order, err := getOrder(ctx, orderID)
	if err != nil {
		return err
	}
	if order.Status != StatusPending {
		return fmt.Errorf("order %s is not PENDING, current status: %s", orderID, order.Status)
	}
	if msp != order.SupplierMSP {
		return fmt.Errorf("only %s can fulfill this order, caller is %s", order.SupplierMSP, msp)
	}
	if batchID == "" {
		return fmt.Errorf("batchID cannot be empty")
	}
	if zkProof == "" {
		return fmt.Errorf("zkProof cannot be empty")
	}
	if publicSignals == "" {
		return fmt.Errorf("publicSignals cannot be empty")
	}

	order.BatchID       = batchID
	order.ZKProof       = zkProof
	order.PublicSignals = publicSignals
	order.Status        = StatusFulfilled
	order.FulfilledAt   = now(ctx)

	if err := putOrder(ctx, order); err != nil {
		return err
	}

	return emitEvent(ctx, "OrderFulfilled", OrderFulfilledEvent{
		OrderID:     order.OrderID,
		SupplierMSP: order.SupplierMSP,
		FulfilledAt: order.FulfilledAt,
		Deadline:    order.Deadline,
	})
}

// VerifyAndAccept is called by the manufacturer after running snarkjs.groth16.verify
// off-chain and confirming the proof passes.
func (s *SmartContract) VerifyAndAccept(
	ctx contractapi.TransactionContextInterface,
	orderID string,
) error {
	msp, err := callerMSP(ctx)
	if err != nil {
		return err
	}

	order, err := getOrder(ctx, orderID)
	if err != nil {
		return err
	}
	if order.Status != StatusFulfilled {
		return fmt.Errorf("order %s must be FULFILLED to accept, current: %s", orderID, order.Status)
	}
	if msp != order.ManufacturerMSP {
		return fmt.Errorf("only %s can accept this order, caller is %s", order.ManufacturerMSP, msp)
	}

	order.Status             = StatusAccepted
	order.VerificationResult = "PASS"
	order.VerifiedBy         = msp
	order.VerifiedAt         = now(ctx)

	if err := putOrder(ctx, order); err != nil {
		return err
	}

	return emitEvent(ctx, "OrderAccepted", OrderDecisionEvent{
		OrderID:    order.OrderID,
		Status:     order.Status,
		VerifiedBy: order.VerifiedBy,
		VerifiedAt: order.VerifiedAt,
	})
}

// RejectOrder is called by the manufacturer when ZK verification fails.
func (s *SmartContract) RejectOrder(
	ctx contractapi.TransactionContextInterface,
	orderID string,
	reason string,
) error {
	msp, err := callerMSP(ctx)
	if err != nil {
		return err
	}
	if reason == "" {
		return fmt.Errorf("rejection reason cannot be empty")
	}

	order, err := getOrder(ctx, orderID)
	if err != nil {
		return err
	}
	if order.Status != StatusFulfilled {
		return fmt.Errorf("order %s must be FULFILLED to reject, current: %s", orderID, order.Status)
	}
	if msp != order.ManufacturerMSP {
		return fmt.Errorf("only %s can reject this order, caller is %s", order.ManufacturerMSP, msp)
	}

	order.Status             = StatusRejected
	order.VerificationResult = "FAIL"
	order.RejectionReason    = reason
	order.VerifiedBy         = msp
	order.VerifiedAt         = now(ctx)

	if err := putOrder(ctx, order); err != nil {
		return err
	}

	return emitEvent(ctx, "OrderRejected", OrderDecisionEvent{
		OrderID:    order.OrderID,
		Status:     order.Status,
		VerifiedBy: order.VerifiedBy,
		VerifiedAt: order.VerifiedAt,
		Reason:     order.RejectionReason,
	})
}

// CancelOrder is called by the manufacturer to cancel a PENDING order.
func (s *SmartContract) CancelOrder(
	ctx contractapi.TransactionContextInterface,
	orderID string,
) error {
	msp, err := callerMSP(ctx)
	if err != nil {
		return err
	}

	order, err := getOrder(ctx, orderID)
	if err != nil {
		return err
	}
	if order.Status != StatusPending {
		return fmt.Errorf("only PENDING orders can be cancelled, current: %s", order.Status)
	}
	if msp != order.ManufacturerMSP {
		return fmt.Errorf("only %s can cancel this order, caller is %s", order.ManufacturerMSP, msp)
	}

	order.Status = StatusCancelled

	if err := putOrder(ctx, order); err != nil {
		return err
	}

	return emitEvent(ctx, "OrderCancelled", OrderDecisionEvent{
		OrderID:    order.OrderID,
		Status:     order.Status,
		VerifiedBy: msp,
		VerifiedAt: now(ctx),
	})
}

// SubmitFeedback is called by the manufacturer after accepting or rejecting.
// Feedback is permanent — cannot be overwritten once submitted.
func (s *SmartContract) SubmitFeedback(
	ctx contractapi.TransactionContextInterface,
	orderID string,
	feedbackText string,
) error {
	msp, err := callerMSP(ctx)
	if err != nil {
		return err
	}
	if feedbackText == "" {
		return fmt.Errorf("feedbackText cannot be empty")
	}

	order, err := getOrder(ctx, orderID)
	if err != nil {
		return err
	}
	if order.Status != StatusAccepted && order.Status != StatusRejected {
		return fmt.Errorf("feedback can only be submitted on ACCEPTED or REJECTED orders, current: %s", order.Status)
	}
	if msp != order.ManufacturerMSP {
		return fmt.Errorf("only %s can submit feedback, caller is %s", order.ManufacturerMSP, msp)
	}
	if order.FeedbackAt != "" {
		return fmt.Errorf("feedback already submitted for order %s on %s", orderID, order.FeedbackAt)
	}

	order.FeedbackText = feedbackText
	order.FeedbackAt   = now(ctx)

	if err := putOrder(ctx, order); err != nil {
		return err
	}

	return emitEvent(ctx, "FeedbackSubmitted", FeedbackSubmittedEvent{
		OrderID:         order.OrderID,
		SupplierMSP:     order.SupplierMSP,
		ManufacturerMSP: order.ManufacturerMSP,
		FeedbackAt:      order.FeedbackAt,
	})
}

// ── Read Functions ───────────────────────────────────────────────────────────

// GetOrder returns a single order by ID.
func (s *SmartContract) GetOrder(
	ctx contractapi.TransactionContextInterface,
	orderID string,
) (*Order, error) {
	return getOrder(ctx, orderID)
}

// GetAllOrders returns every order on this channel (skips Requirements entries).
func (s *SmartContract) GetAllOrders(
	ctx contractapi.TransactionContextInterface,
) ([]*Order, error) {
	iterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, fmt.Errorf("failed to get all orders: %v", err)
	}
	defer iterator.Close()

	var orders []*Order
	for iterator.HasNext() {
		result, err := iterator.Next()
		if err != nil {
			return nil, err
		}
		// Skip Requirements entries stored under "REQ-" prefix
		if len(result.Key) >= 4 && result.Key[:4] == "REQ-" {
			continue
		}
		var order Order
		if err := json.Unmarshal(result.Value, &order); err != nil {
			continue
		}
		orders = append(orders, &order)
	}
	return orders, nil
}

// GetOrdersBySupplier returns all orders assigned to a specific supplier.
func (s *SmartContract) GetOrdersBySupplier(
	ctx contractapi.TransactionContextInterface,
	supplierMSP string,
) ([]*Order, error) {
	all, err := s.GetAllOrders(ctx)
	if err != nil {
		return nil, err
	}
	var filtered []*Order
	for _, o := range all {
		if o.SupplierMSP == supplierMSP {
			filtered = append(filtered, o)
		}
	}
	return filtered, nil
}

// GetOrdersByManufacturer returns all orders created by a specific manufacturer.
func (s *SmartContract) GetOrdersByManufacturer(
	ctx contractapi.TransactionContextInterface,
	manufacturerMSP string,
) ([]*Order, error) {
	all, err := s.GetAllOrders(ctx)
	if err != nil {
		return nil, err
	}
	var filtered []*Order
	for _, o := range all {
		if o.ManufacturerMSP == manufacturerMSP {
			filtered = append(filtered, o)
		}
	}
	return filtered, nil
}

// GetOrderHistory returns the full audit trail for an order.
func (s *SmartContract) GetOrderHistory(
	ctx contractapi.TransactionContextInterface,
	orderID string,
) ([]HistoryRecord, error) {
	iterator, err := ctx.GetStub().GetHistoryForKey(orderID)
	if err != nil {
		return nil, fmt.Errorf("failed to get history for %s: %v", orderID, err)
	}
	defer iterator.Close()

	var history []HistoryRecord
	for iterator.HasNext() {
		record, err := iterator.Next()
		if err != nil {
			return nil, err
		}
		entry := HistoryRecord{
			TxID:      record.TxId,
			Timestamp: record.Timestamp.String(),
			IsDelete:  record.IsDelete,
		}
		if !record.IsDelete {
			var order Order
			if err := json.Unmarshal(record.Value, &order); err == nil {
				entry.Value = &order
			}
		}
		history = append(history, entry)
	}
	return history, nil
}

// ── Entry Point ──────────────────────────────────────────────────────────────

func main() {
	cc, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		panic(fmt.Sprintf("Error creating VeritasChain order chaincode: %v", err))
	}
	if err := cc.Start(); err != nil {
		panic(fmt.Sprintf("Error starting VeritasChain order chaincode: %v", err))
	}
}
