package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func createAlipayTestOrder(t *testing.T, userId int, tradeNo string, money float64, provider string) TopUp {
	t.Helper()
	topUp := TopUp{
		UserId:          userId,
		Amount:          2,
		Money:           money,
		TradeNo:         tradeNo,
		PaymentMethod:   PaymentMethodAlipay,
		PaymentProvider: provider,
		CreateTime:      common.GetTimestamp(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, DB.Create(&topUp).Error)
	return topUp
}

func TestRechargeAlipayCreditsQuotaExactlyOnce(t *testing.T) {
	truncateTables(t)

	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })

	user := insertUserForPaymentGuardTest(t, 601, 0)
	order := createAlipayTestOrder(t, user.Id, "ALI601NOONCE", 10.0, PaymentProviderAlipay)

	alreadyDone, err := RechargeAlipay(order.TradeNo, decimal.RequireFromString("10.00"), "2026110222001", "127.0.0.1")
	require.NoError(t, err)
	assert.False(t, alreadyDone)
	assert.Equal(t, 2*500000, getUserQuotaForPaymentGuardTest(t, user.Id))

	// 重复通知：幂等，不重复加额度
	alreadyDone, err = RechargeAlipay(order.TradeNo, decimal.RequireFromString("10.00"), "2026110222001", "127.0.0.1")
	require.NoError(t, err)
	assert.True(t, alreadyDone)
	assert.Equal(t, 2*500000, getUserQuotaForPaymentGuardTest(t, user.Id))

	stored := GetTopUpByTradeNo(order.TradeNo)
	require.NotNil(t, stored)
	assert.Equal(t, common.TopUpStatusSuccess, stored.Status)
	assert.NotZero(t, stored.CompleteTime)
}

func TestRechargeAlipayRejectsAmountMismatch(t *testing.T) {
	truncateTables(t)

	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })

	user := insertUserForPaymentGuardTest(t, 602, 0)
	order := createAlipayTestOrder(t, user.Id, "ALI602NOMISMATCH", 10.0, PaymentProviderAlipay)

	_, err := RechargeAlipay(order.TradeNo, decimal.RequireFromString("0.01"), "2026110222002", "127.0.0.1")
	require.ErrorIs(t, err, ErrAlipayAmountMismatch)
	assert.Equal(t, 0, getUserQuotaForPaymentGuardTest(t, user.Id))

	// 金额不符时订单保持 pending，等待真实通知
	stored := GetTopUpByTradeNo(order.TradeNo)
	require.NotNil(t, stored)
	assert.Equal(t, common.TopUpStatusPending, stored.Status)
}

func TestRechargeAlipayRejectsForeignProvider(t *testing.T) {
	truncateTables(t)

	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })

	user := insertUserForPaymentGuardTest(t, 603, 0)
	order := createAlipayTestOrder(t, user.Id, "ALI603NOFOREIGN", 10.0, PaymentProviderEpay)

	_, err := RechargeAlipay(order.TradeNo, decimal.RequireFromString("10.00"), "2026110222003", "127.0.0.1")
	require.ErrorIs(t, err, ErrPaymentMethodMismatch)
	assert.Equal(t, 0, getUserQuotaForPaymentGuardTest(t, user.Id))
}

func TestRechargeAlipayUnknownOrder(t *testing.T) {
	truncateTables(t)

	_, err := RechargeAlipay("ALINOTEXIST", decimal.NewFromInt(1), "", "127.0.0.1")
	require.ErrorIs(t, err, ErrTopUpNotFound)
}

func TestAlipayOrderExpiryKeepsPendingStatusCheck(t *testing.T) {
	truncateTables(t)

	user := insertUserForPaymentGuardTest(t, 604, 0)
	order := createAlipayTestOrder(t, user.Id, "ALI604NOEXPIRED", 10.0, PaymentProviderAlipay)

	require.NoError(t, UpdatePendingTopUpStatus(order.TradeNo, PaymentProviderAlipay, common.TopUpStatusExpired))

	_, err := RechargeAlipay(order.TradeNo, decimal.RequireFromString("10.00"), "2026110222004", "127.0.0.1")
	require.ErrorIs(t, err, ErrTopUpStatusInvalid)

	stored := GetTopUpByTradeNo(order.TradeNo)
	require.NotNil(t, stored)
	assert.Equal(t, common.TopUpStatusExpired, stored.Status)
	assert.WithinDuration(t, time.Now(), time.Unix(stored.CreateTime, 0), 5*time.Minute)
}
