const request = require("supertest");
const app = require("../service.js");
const { Role, DB } = require("../database/database.js");

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  jest.setTimeout(60 * 1000 * 5); // 5 minutes
}

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;
let testAdminUser;
let adminToken;

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);

  // Create test admin user
  const user = await createAdminUser();
  testAdminUser = user;
  adminToken = await getAdminToken();
});

beforeEach(async () => {
  // Delete all franchise data that was left from previous test
  const franchiseData = {
    name: "test",
    admins: [{ email: testAdminUser.email }],
  };
  // Get franchises
  const getRes = await request(app).get("/api/franchise").send(franchiseData);
  const franchises = getRes.body;
  // Delete franchise as an admin user
  for (const franchise of franchises) {
    await request(app)
      .delete(`/api/franchise/${franchise.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
  }
});

test("createOrder", async () => {
  const franchiseData = {
    name: "pizzaCreateTest",
    admins: [{ email: testAdminUser.email }],
  };

  // Create franchise as an admin user
  const createRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${adminToken}`)
    .send(franchiseData);

  const getRes = await request(app).get("/api/franchise").send(franchiseData);
  const franchises = getRes.body;
  const franchise = franchises.filter(
    (item) => item.name === franchiseData.name
  )[0];

  const storeData = { franchiseId: franchise.id, name: "Test Store" };

  const createStoreAdminRes = await request(app)
    .post(`/api/franchise/${franchise.id}/store`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send(storeData);

  const orderData = {
    franchiseId: franchise.id,
    storeId: 1,
    items: [{ menuId: 1, description: "Veggie", price: 0.05 }],
  };

  // Create order as a non-authenticated user
  const res = await request(app)
    .post("/api/order")
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send(orderData);

  expect(res.status).toBe(200);
  expect(res.body.order).toHaveProperty("franchiseId", orderData.franchiseId);
  expect(res.body.order).toHaveProperty("storeId", orderData.storeId);
  expect(res.body.order.items[0]).toHaveProperty(
    "menuId",
    orderData.items[0].menuId
  );
});

test("getOrders", async () => {
  const res = await request(app)
    .get("/api/order")
    .set("Authorization", `Bearer ${testUserAuthToken}`);

  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty("orders");
  expect(Array.isArray(res.body.orders)).toBe(true);
});

test("getMenu", async () => {
  const res = await request(app).get("/api/order/menu");
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});

// Helper Functions

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
  );
}

async function createAdminUser() {
  let user = { password: "toomanysecrets", roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + "@admin.com";

  user = await DB.addUser(user);
  return { ...user, password: "toomanysecrets" };
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

async function getAdminToken() {
  const loginRes = await request(app)
    .put("/api/auth")
    .send({ email: testAdminUser.email, password: "toomanysecrets" });

  return loginRes.body.token;
}
