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
    const adminDeleteRes = await request(app)
      .delete(`/api/franchise/${franchise.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
  }
});

test("getFranchises", async () => {
  const franchiseData = {
    name: "pizzaGetTest",
    admins: [{ email: testAdminUser.email }],
  };

  // Create franchise
  const createRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${adminToken}`)
    .send(franchiseData);

  const res = await request(app)
    .get("/api/franchise")
    .set("Authorization", `Bearer ${adminToken}`);

  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  expect(res.body[0]).toHaveProperty("id");
  expect(res.body[0]).toHaveProperty("name");
});

test("getUserFranchises", async () => {
  const franchiseData = {
    name: "pizzaGetUserTest",
    admins: [{ email: testAdminUser.email }],
  };

  // Create franchise
  const createRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${adminToken}`)
    .send(franchiseData);

  const userFranchiseRes = await request(app)
    .get(`/api/franchise/${testAdminUser.id}`)
    .set("Authorization", `Bearer ${adminToken}`);

  expect(userFranchiseRes.status).toBe(200);
  expect(Array.isArray(userFranchiseRes.body)).toBe(true);
});

test("createFranchise", async () => {
  const franchiseData = {
    name: "pizzaCreateTest",
    admins: [{ email: testAdminUser.email }],
  };

  // Try creating franchise as a non-admin user
  const res = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send(franchiseData);

  expect(res.status).toBe(403);
  expect(res.body.message).toBe("unable to create a franchise");

  // Create franchise as an admin user
  const createRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${adminToken}`)
    .send(franchiseData);

  expect(createRes.status).toBe(200);
  expect(createRes.body).toMatchObject(franchiseData);
});

test("deleteFranchise", async () => {
  const franchiseData = {
    name: "pizzaDeleteTest",
    admins: [{ email: testAdminUser.email }],
  };

  // Create franchise as an admin user
  const createRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${adminToken}`)
    .send(franchiseData);

  // Get franchise
  const getRes = await request(app).get("/api/franchise").send(franchiseData);
  const franchise = getRes.body.filter(
    (fran) => fran.name === franchiseData.name
  )[0];

  // Try deleting franchise as a non-admin user
  const deleteRes = await request(app)
    .delete(`/api/franchise/${franchise.id}`)
    .set("Authorization", `Bearer ${testUserAuthToken}`);

  expect(deleteRes.status).toBe(403);
  expect(deleteRes.body.message).toBe("unable to delete a franchise");

  // Delete franchise as an admin user
  const adminDeleteRes = await request(app)
    .delete(`/api/franchise/${franchise.id}`)
    .set("Authorization", `Bearer ${adminToken}`);

  expect(adminDeleteRes.status).toBe(200);
  expect(adminDeleteRes.body.message).toBe("franchise deleted");
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
