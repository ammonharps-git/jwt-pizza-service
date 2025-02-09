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
    name: "createOrderTest",
    admins: [{ email: testAdminUser.email }],
  };

  // Create franchise as an admin user
  await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${adminToken}`)
    .send(franchiseData);

  let getRes = await request(app).get("/api/franchise").send(franchiseData);
  let franchises = getRes.body;
  let franchise = franchises.filter(
    (item) => item.name === franchiseData.name
  )[0];

  const storeData = { franchiseId: franchise.id, name: "Test Store" };

  await request(app)
    .post(`/api/franchise/${franchise.id}/store`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send(storeData);

  // I think the problem relates to the store id? Check it?

  getRes = await request(app).get("/api/franchise").send(franchiseData);
  franchises = getRes.body;
  franchise = franchises.filter((item) => item.name === franchiseData.name)[0];

  const orderData = {
    franchiseId: 1,
    storeId: 1,
    items: [{ menuId: 1, description: "Veggie", price: 0.05 }],
  };

  // Create order
  await request(app)
    .post("/api/order")
    .set("Authorization", `Bearer ${adminToken}`)
    .send(orderData);
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

test("addMenuItem (admin only)", async () => {
  const menuItem = {
    title: "Student",
    description: "No topping, no sauce, just carbs",
    image: "pizza9.png",
    price: 0.0001,
  };

  // Try adding menu item as a non-admin user
  const res = await request(app)
    .put("/api/order/menu")
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send(menuItem);

  expect(res.status).toBe(403);
  expect(res.body.message).toBe("unable to add menu item");

  // Add menu item as an admin user
  const adminToken = await getAdminToken();
  await request(app)
    .put("/api/order/menu")
    .set("Authorization", `Bearer ${adminToken}`)
    .send(menuItem);
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
