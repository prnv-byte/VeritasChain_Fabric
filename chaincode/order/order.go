package main

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
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

// ── Asset Definition ─────────────────────────────────────────────────────────

// Order is the single universal asset stored on every VeritasChain channel.
// It is component-agnostic — works for batteries, motors, steel, or anything else.
type Order struct {
	// ── Identity ──────────────────────────────────────────────────────────
	OrderID         string `json:"orderID"`
	ManufacturerMSP string `json:"manufacturerMSP"` // set from caller cert, unforgeable
	SupplierMSP     string `json:"supplierMSP"`     // who must fulfill this order
	ComponentType   string `json:"componentType"`   // free text: "battery", "steel", anything

	// ── Order Details ─────────────────────────────────────────────────────
	Quantity       int    `json:"quantity"`
	Specifications string `json:"specifications"` // JSON string with component-specific specs
	Deadline       string `json:"deadline"`       // ISO timestamp — used by AI agent for tracking
	Status         string `json:"status"`
	CreatedAt      string `json:"createdAt"`

	// ── Fulfillment (filled by supplier in FulfillOrder) ──────────────────
	BatchID      string `json:"batchID"`
	VkURL        string `json:"vkURL"`        // AWS S3 URL for .vk  (verification key)
	PfURL        string `json:"pfURL"`        // AWS S3 URL for .pf  (proof file)
	SrhURL       string `json:"srhURL"`       // AWS S3 URL for .srh (public signals)
	SettingsURL  string `json:"settingsURL"`  // AWS S3 URL for settings.json
	VkHash       string `json:"vkHash"`       // SHA-256 of .vk  — tamper-evident seal
	PfHash       string `json:"pfHash"`       // SHA-256 of .pf
	SrhHash      string `json:"srhHash"`      // SHA-256 of .srh
	SettingsHash string `json:"settingsHash"` // SHA-256 of settings.json
	FulfilledAt  string `json:"fulfilledAt"`

	// ── Verification (filled by manufacturer after running ZK verifier) ───
	VerificationResult string `json:"verificationResult"` // "PASS" or "FAIL"
	RejectionReason    string `json:"rejectionReason"`    // only set on rejection
	VerifiedBy         string `json:"verifiedBy"`
	VerifiedAt         string `json:"verifiedAt"`

	// ── Feedback (filled by manufacturer after decision) ──────────────────
	FeedbackText string `json:"feedbackText"`
	FeedbackAt   string `json:"feedbackAt"`
}

// ── Event Payloads ───────────────────────────────────────────────────────────
// These are what the AI agent's event listener receives.

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
	Deadline    string `json:"deadline"` // AI agent uses this to check if delivery was on time
}

type OrderDecisionEvent struct {
	OrderID    string `json:"orderID"`
	Status     string `json:"status"`
	VerifiedBy string `json:"verifiedBy"`
	VerifiedAt string `json:"verifiedAt"`
	Reason     string `json:"reason,omitempty"` // only present on rejection
}

type FeedbackSubmittedEvent struct {
	OrderID         string `json:"orderID"`
	SupplierMSP     string `json:"supplierMSP"`
	ManufacturerMSP string `json:"manufacturerMSP"`
	FeedbackAt      string `json:"feedbackAt"`
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

func now() string {
	return time.Now().UTC().Format(time.RFC3339)
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

func isValidSHA256(hash string) bool {
	matched, _ := regexp.MatchString(`^[a-fA-F0-9]{64}$`, hash)
	return matched
}

func isValidURL(url string) bool {
	return strings.HasPrefix(url, "https://")
}

func emitEvent(ctx contractapi.TransactionContextInterface, name string, payload interface{}) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal %s event: %v", name, err)
	}
	return ctx.GetStub().SetEvent(name, data)
}

// ── Write Functions ──────────────────────────────────────────────────────────

// CreateOrder is called by a manufacturer to raise a new component order.
// Any registered org can be a manufacturer — no hardcoded MSP names.
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
		CreatedAt:       now(),
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

// FulfillOrder is called by the supplier after uploading ZK files to S3.
// It records the 4 file URLs and their SHA-256 hashes as a tamper-evident seal.
func (s *SmartContract) FulfillOrder(
	ctx contractapi.TransactionContextInterface,
	orderID string,
	batchID string,
	vkURL string,
	pfURL string,
	srhURL string,
	settingsURL string,
	vkHash string,
	pfHash string,
	srhHash string,
	settingsHash string,
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

	for name, url := range map[string]string{
		"vkURL": vkURL, "pfURL": pfURL, "srhURL": srhURL, "settingsURL": settingsURL,
	} {
		if !isValidURL(url) {
			return fmt.Errorf("%s must be a valid HTTPS URL, got: %s", name, url)
		}
	}

	for name, hash := range map[string]string{
		"vkHash": vkHash, "pfHash": pfHash, "srhHash": srhHash, "settingsHash": settingsHash,
	} {
		if !isValidSHA256(hash) {
			return fmt.Errorf("%s must be a valid 64-char SHA-256 hex string", name)
		}
	}

	order.BatchID = batchID
	order.VkURL = vkURL
	order.PfURL = pfURL
	order.SrhURL = srhURL
	order.SettingsURL = settingsURL
	order.VkHash = vkHash
	order.PfHash = pfHash
	order.SrhHash = srhHash
	order.SettingsHash = settingsHash
	order.Status = StatusFulfilled
	order.FulfilledAt = now()

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

// VerifyAndAccept is called by the manufacturer after running the ZK verifier
// locally and confirming the proof passes. Records the acceptance on-chain.
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

	order.Status = StatusAccepted
	order.VerificationResult = "PASS"
	order.VerifiedBy = msp
	order.VerifiedAt = now()

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

// RejectOrder is called by the manufacturer when ZK verification fails
// or the delivery does not meet requirements.
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

	order.Status = StatusRejected
	order.VerificationResult = "FAIL"
	order.RejectionReason = reason
	order.VerifiedBy = msp
	order.VerifiedAt = now()

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
// Cannot cancel once the supplier has already submitted their work.
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
		VerifiedAt: now(),
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
	order.FeedbackAt = now()

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

// GetOrder returns a single order by ID. Any channel member can call this.
func (s *SmartContract) GetOrder(
	ctx contractapi.TransactionContextInterface,
	orderID string,
) (*Order, error) {
	return getOrder(ctx, orderID)
}

// GetAllOrders returns every order on this channel.
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
		var order Order
		if err := json.Unmarshal(result.Value, &order); err != nil {
			return nil, err
		}
		orders = append(orders, &order)
	}
	return orders, nil
}

// GetOrdersBySupplier returns all orders assigned to a specific supplier.
// Used by the supplier dashboard to show incoming orders.
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
// Used by the manufacturer dashboard.
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

// GetOrderHistory returns the full audit trail for an order — every state
// change, who made it, and when. Immutable record of the entire lifecycle.
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
