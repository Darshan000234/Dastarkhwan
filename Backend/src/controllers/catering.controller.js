
import prisma from "../db/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";

import {
  HttpError,
  assertObject,
  assertAllowedKeys,
  requiredString,
  validatePincode,
  validatePhone,
  validateEmail,
  validateId,
  validatePagination,
  findEligibleOutlets,
  publicOutlet,
  paginationResponse,
} from "../utils/customerDomain.js";

function success(res, data, status = 200, message) {
  return res.status(status).json({
    success: true,
    ...(message ? { message } : {}),
    data,
  });
}

function readConfigInteger(name, fallback, minimum, maximum) {
  const raw = process.env[name];

  if (raw === undefined || raw === "") return fallback;

  const value = Number(raw);

  if (
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(`${name} has an invalid configuration value.`);
  }

  return value;
}

function currentIstDateUtc() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return Date.UTC(
    Number(value.year),
    Number(value.month) - 1,
    Number(value.day)
  );
}

function parseEventDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    throw new HttpError(
      "Event date must use YYYY-MM-DD format.",
      400
    );
  }

  const [year, month, day] = value.split("-").map(Number);
  const dateUtc = Date.UTC(year, month - 1, day);

  const checked = new Date(dateUtc);

  if (
    checked.getUTCFullYear() !== year ||
    checked.getUTCMonth() !== month - 1 ||
    checked.getUTCDate() !== day
  ) {
    throw new HttpError("Enter a valid event date.", 400);
  }

  return {
    dateUtc,
    // Store noon in India Standard Time.
    eventDate: new Date(dateUtc + (12 - 5.5) * 60 * 60 * 1000),
  };
}

function cateringStatusLabel(status) {
  const map = {
    NEW: "Pending Manager Confirmation",
    CONTACTED: "Contacted",
    QUOTED: "Quote Prepared",
    CONFIRMED: "Confirmed",
    DECLINED: "Declined",
    COMPLETED: "Completed",
  };

  return map[status] || status;
}

function mapCateringEnquiry(enquiry) {
  return {
    id: enquiry.id,
    contactName: enquiry.contactName,
    contactPhone: enquiry.contactPhone,
    contactEmail: enquiry.contactEmail,
    eventType: enquiry.eventType,
    eventDate: enquiry.eventDate?.toISOString() || null,
    guestCount: enquiry.guestCount,
    location: enquiry.location,
    budget: enquiry.budget === null
      ? null
      : Number(enquiry.budget),
    requirements: enquiry.requirements,
    status: cateringStatusLabel(enquiry.status),
    outlet: enquiry.outlet
      ? {
          id: enquiry.outlet.id,
          name: enquiry.outlet.name,
        }
      : null,
    createdAt: enquiry.createdAt.toISOString(),
  };
}

/* =========================================================
   CREATE CATERING ENQUIRY
   POST /api/v1/customer/catering/enquiries
========================================================= */

export const createCateringEnquiry = asyncHandler(
  async (req, res) => {
    assertObject(req.body);

    assertAllowedKeys(req.body, [
      "name",
      "phone",
      "email",
      "date",
      "eventType",
      "guests",
      "pincode",
      "outletId",
      "foodPreference",
      "preference",
      "requirements",
      "message",
    ]);

    const contactName = requiredString(
      req.body.name,
      "contact name",
      120,
      2
    );

    const contactPhone = validatePhone(
      req.body.phone,
      "contact phone"
    );

    const contactEmail = validateEmail(
      req.body.email,
      true
    );

    const eventType = requiredString(
      req.body.eventType,
      "event type",
      80,
      2
    );

    const pincode = validatePincode(req.body.pincode);

    const guestCount = req.body.guests;

    const minimumGuests = readConfigInteger(
      "CATERING_MIN_GUESTS",
      15,
      1,
      100000
    );

    const maximumGuests = readConfigInteger(
      "CATERING_MAX_GUESTS",
      1000,
      minimumGuests,
      100000
    );

    if (
      !Number.isSafeInteger(guestCount) ||
      guestCount < minimumGuests ||
      guestCount > maximumGuests
    ) {
      throw new HttpError(
        `Guest count must be between ${minimumGuests} and ${maximumGuests}.`,
        400
      );
    }

    const minimumNoticeDays = readConfigInteger(
      "CATERING_MIN_NOTICE_DAYS",
      3,
      0,
      365
    );

    const { dateUtc, eventDate } = parseEventDate(
      req.body.date
    );

    const minimumEventDate =
      currentIstDateUtc() +
      minimumNoticeDays * 24 * 60 * 60 * 1000;

    if (dateUtc < minimumEventDate) {
      throw new HttpError(
        `Please submit your enquiry at least ${minimumNoticeDays} days before the event.`,
        422,
        "INSUFFICIENT_CATERING_NOTICE"
      );
    }

    const foodPreference = req.body.foodPreference;

    const allowedFoodPreferences = [
      "Both vegetarian and non-vegetarian",
      "Vegetarian only",
      "Non-vegetarian only",
    ];

    if (
      typeof foodPreference !== "string" ||
      !allowedFoodPreferences.includes(foodPreference)
    ) {
      throw new HttpError(
        "Choose a valid food preference.",
        400
      );
    }

    const dietaryPreference = req.body.preference;

    const allowedDietaryPreferences = [
      "No preference",
      "Less spicy",
      "Jain-friendly options",
      "Allergy-aware menu discussion",
    ];

    if (
      typeof dietaryPreference !== "string" ||
      !allowedDietaryPreferences.includes(dietaryPreference)
    ) {
      throw new HttpError(
        "Choose a valid dietary preference.",
        400
      );
    }

    const requirements =
      req.body.requirements === undefined
        ? ""
        : requiredString(
            req.body.requirements,
            "special requirements",
            500,
            0
          );

    const message =
      req.body.message === undefined
        ? ""
        : requiredString(
            req.body.message,
            "additional message",
            500,
            0
          );

    const eligibleOutlets = await findEligibleOutlets(
      prisma,
      pincode
    );

    if (!eligibleOutlets.length) {
      throw new HttpError(
        "No active outlet currently serves this event pincode.",
        422,
        "NOT_SERVICEABLE"
      );
    }

    let selectedOutlet = eligibleOutlets[0];

    if (req.body.outletId) {
      const outletId = validateId(
        req.body.outletId,
        "outlet ID"
      );

      selectedOutlet = eligibleOutlets.find(
        (entry) => entry.id === outletId
      );

      if (!selectedOutlet) {
        throw new HttpError(
          "The preferred outlet does not serve this pincode.",
          422,
          "OUTLET_NOT_SERVICEABLE"
        );
      }
    }

    /*
     * Schema limitation:
     * CateringEnquiry currently has no dedicated pincode,
     * foodPreference, or dietaryPreference columns.
     *
     * Preserve the submitted values in the existing fields.
     * The frontend currently collects a pincode, not a full
     * event address.
     */

    const location = [
      selectedOutlet.locality,
      selectedOutlet.city?.name,
      `Pincode ${pincode}`,
    ]
      .filter(Boolean)
      .join(", ")
      .slice(0, 250);

    const requirementParts = [
      `Food preference: ${foodPreference}`,
      `Dietary preference: ${dietaryPreference}`,
      requirements
        ? `Special requirements: ${requirements}`
        : null,
      message
        ? `Additional message: ${message}`
        : null,
    ].filter(Boolean);

    const combinedRequirements =
      requirementParts.join("\n").slice(0, 1500);

    const enquiry = await prisma.cateringEnquiry.create({
      data: {
        userId: req.user.id,
        outletId: selectedOutlet.id,
        contactName,
        contactPhone,
        contactEmail,
        eventType,
        eventDate,
        guestCount,
        location,
        requirements: combinedRequirements,
        status: "NEW",
      },
      include: {
        outlet: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return success(
      res,
      {
        enquiry: mapCateringEnquiry(enquiry),
        minimumNoticeDays,
        confirmationRequired: true,
      },
      201,
      "Catering enquiry received. A manager must confirm availability."
    );
  }
);

/* =========================================================
   LIST MY CATERING ENQUIRIES
   GET /api/v1/customer/catering/enquiries
========================================================= */

export const listMyCateringEnquiries = asyncHandler(
  async (req, res) => {
    const { page, limit, skip } = validatePagination(req.query);

    const where = {
      userId: req.user.id,
    };

    const [rows, total] = await Promise.all([
      prisma.cateringEnquiry.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
        include: {
          outlet: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),

      prisma.cateringEnquiry.count({ where }),
    ]);

    return success(res, {
      enquiries: rows.map(mapCateringEnquiry),
      pagination: paginationResponse(page, limit, total),
    });
  }
);
