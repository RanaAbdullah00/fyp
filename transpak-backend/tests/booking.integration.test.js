const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const bookingService = require("../services/bookingService");
const User = require("../models/User");
const Load = require("../models/Load");
const Bid = require("../models/Bid");

let mongod;

async function mkUser({ email, phone, cnic, role }) {
  return User.create({
    name: email.split("@")[0],
    email,
    phone,
    cnic,
    passwordHash: "hash",
    roles: [role],
    activeRole: role,
    verified: true
  });
}

test.before(async () => {
  process.env.NODE_ENV = "development";
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

test.beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Load.deleteMany({}), Bid.deleteMany({})]);
});

test("prevents double booking under concurrent accept attempts", async () => {
  const shipper = await mkUser({
    email: "shipper@test.com",
    phone: "+923001111111",
    cnic: "12345-0000000-1",
    role: "shipper"
  });
  const carrierA = await mkUser({
    email: "carrier-a@test.com",
    phone: "+923001111112",
    cnic: "12345-0000000-2",
    role: "carrier"
  });
  const carrierB = await mkUser({
    email: "carrier-b@test.com",
    phone: "+923001111113",
    cnic: "12345-0000000-3",
    role: "carrier"
  });

  const load = await Load.create({
    code: "L-100001",
    cargo: "Steel",
    origin: "Lahore",
    destination: "Karachi",
    weight: 10,
    vehicleType: "Truck",
    expectedPrice: 120000,
    pickupDate: "2099-01-01",
    shipperId: shipper._id
  });

  const bidA = await Bid.create({
    loadId: load._id,
    carrierId: carrierA._id,
    amount: 110000,
    transitTime: 2,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000)
  });
  const bidB = await Bid.create({
    loadId: load._id,
    carrierId: carrierB._id,
    amount: 111000,
    transitTime: 2,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000)
  });

  const [r1, r2] = await Promise.allSettled([
    bookingService.shipperAcceptBid(String(bidA._id), String(shipper._id), ["shipper"]),
    bookingService.shipperAcceptBid(String(bidB._id), String(shipper._id), ["shipper"])
  ]);

  const fulfilled = [r1, r2].filter((r) => r.status === "fulfilled");
  const rejected = [r1, r2].filter((r) => r.status === "rejected");

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason?.statusCode, 409);

  const freshLoad = await Load.findById(load._id);
  const freshA = await Bid.findById(bidA._id);
  const freshB = await Bid.findById(bidB._id);
  assert.equal(freshLoad.status, "assigned");
  assert.ok(freshLoad.acceptedBidId);
  assert.equal(
    [String(freshA._id), String(freshB._id)].includes(String(freshLoad.acceptedBidId)),
    true
  );
  assert.equal(
    [freshA.status, freshB.status].sort().join(","),
    "accepted,rejected"
  );
});

test("returns idempotent result when same bid is accepted twice", async () => {
  const shipper = await mkUser({
    email: "shipper2@test.com",
    phone: "+923001111114",
    cnic: "12345-0000000-4",
    role: "shipper"
  });
  const carrier = await mkUser({
    email: "carrier2@test.com",
    phone: "+923001111115",
    cnic: "12345-0000000-5",
    role: "carrier"
  });

  const load = await Load.create({
    code: "L-100002",
    cargo: "Rice",
    origin: "Islamabad",
    destination: "Multan",
    weight: 8,
    vehicleType: "Truck",
    expectedPrice: 90000,
    pickupDate: "2099-01-02",
    shipperId: shipper._id
  });

  const bid = await Bid.create({
    loadId: load._id,
    carrierId: carrier._id,
    amount: 85000,
    transitTime: 3,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000)
  });

  const first = await bookingService.shipperAcceptBid(String(bid._id), String(shipper._id), ["shipper"]);
  const second = await bookingService.shipperAcceptBid(String(bid._id), String(shipper._id), ["shipper"]);

  assert.ok(first.bookingReference);
  assert.equal(second.idempotent, true);
  assert.equal(second.bookingReference, first.bookingReference);
  assert.equal(second.bidId, first.bidId);
  assert.equal(second.loadId, first.loadId);
});
