
import prisma from "../db/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";

import {
  HttpError,
  assertObject,
  assertAllowedKeys,
  validatePagination,
  buildCartQuote,
  paginationResponse,
} from "../utils/customerDomain.js";

function success(res, data) {
  return res.status(200).json({
    success: true,
    data,
  });
}

function mapLoyaltyTransaction(entry) {
  return {
    id: entry.id,
    type: entry.type.toLowerCase(),
    points: entry.pointsDelta,
    note:
      entry.description ||
      (entry.order?.orderNumber
        ? `Order ${entry.order.orderNumber}`
        : entry.type),
    orderNumber: entry.order?.orderNumber || null,
    at: entry.createdAt.toISOString(),
  };
}

/* =========================================================
   GET LOYALTY SUMMARY
   GET /api/v1/customer/rewards
========================================================= */

export const getLoyaltySummary = asyncHandler(async (req, res) => {
  const account = await prisma.loyaltyAccount.findUnique({
    where: {
      userId: req.user.id,
    },
    select: {
      id: true,
      pointsBalance: true,
      lifetimeEarned: true,
    },
  });

  if (!account) {
    return success(res, {
      balance: 0,
      lifetimeEarned: 0,
      lifetimeRedeemed: 0,
      redemption: {
        pointsPerRupee: 10,
        pointsPerReward: 100,
        rewardValue: 10,
        maximumSubtotalPercentage: 25,
      },
      transactions: [],
    });
  }

  const [redeemed, recent] = await Promise.all([
    prisma.loyaltyTransaction.aggregate({
      where: {
        accountId: account.id,
        pointsDelta: {
          lt: 0,
        },
      },
      _sum: {
        pointsDelta: true,
      },
    }),

    prisma.loyaltyTransaction.findMany({
      where: {
        accountId: account.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
      include: {
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
    }),
  ]);

  return success(res, {
    balance: account.pointsBalance,
    lifetimeEarned: account.lifetimeEarned,
    lifetimeRedeemed: Math.abs(
      redeemed._sum.pointsDelta || 0
    ),
    redemption: {
      pointsPerRupee: 10,
      pointsPerReward: 100,
      rewardValue: 10,
      maximumSubtotalPercentage: 25,
    },
    transactions: recent.map(mapLoyaltyTransaction),
  });
});

/* =========================================================
   GET LOYALTY TRANSACTIONS
   GET /api/v1/customer/rewards/transactions
========================================================= */

export const getLoyaltyTransactions = asyncHandler(
  async (req, res) => {
    const { page, limit, skip } = validatePagination(req.query);

    const where = {
      userId: req.user.id,
    };

    const [rows, total] = await Promise.all([
      prisma.loyaltyTransaction.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
        include: {
          order: {
            select: {
              orderNumber: true,
            },
          },
        },
      }),

      prisma.loyaltyTransaction.count({ where }),
    ]);

    return success(res, {
      transactions: rows.map(mapLoyaltyTransaction),
      pagination: paginationResponse(page, limit, total),
    });
  }
);

/* =========================================================
   REDEEM POINTS — CHECKOUT PREVIEW ONLY
   POST /api/v1/customer/rewards/redeem
========================================================= */

/*
 * This endpoint does not deduct points.
 *
 * The current schema has no temporary redemption-reservation
 * model. The authoritative deduction must happen inside the
 * successful checkout/payment transaction.
 *
 * The cart, address, coupon, customer balance and maximum
 * eligible redemption are all revalidated here.
 */

export const redeemPoints = asyncHandler(async (req, res) => {
  assertObject(req.body);

  assertAllowedKeys(req.body, [
    "points",
    "outletId",
    "addressId",
    "items",
    "cart",
    "couponCode",
  ]);

  const points = req.body.points;

  if (
    !Number.isSafeInteger(points) ||
    points <= 0 ||
    points > 1000000 ||
    points % 100 !== 0
  ) {
    throw new HttpError(
      "Requested points must be a positive multiple of 100.",
      400
    );
  }

  const quote = await buildCartQuote(
    prisma,
    req.user.id,
    {
      outletId: req.body.outletId,
      addressId: req.body.addressId,
      items: req.body.items ?? req.body.cart,
      couponCode: req.body.couponCode,
      loyaltyPoints: points,
    }
  );

  return success(res, {
    previewOnly: true,
    redeemedPoints: quote.loyaltyPoints,
    discount: quote.loyaltyDiscount,
    remainingBalance:
      quote.loyaltyAccount.pointsBalance - quote.loyaltyPoints,
    subtotal: quote.subtotal,
    couponDiscount: quote.couponDiscount,
    finalTotal: quote.total,
    message:
      "This is a checkout preview. Points are deducted only after successful payment confirmation.",
  });
});
