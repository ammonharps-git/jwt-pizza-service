const request = require("supertest");
const app = require("../service.js");
const { Role, DB } = require("../database/database.js");

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  jest.setTimeout(60 * 1000 * 5); // 5 minutes
}

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;
let testAdminUser;

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);

  // Create test admin user
  const user = await createAdminUser();
  testAdminUser = user;
});

test("login", async () => {
  const loginRes = await request(app).put("/api/auth").send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const expectedUser = { ...testUser, roles: [{ role: "diner" }] };
  delete expectedUser.password;
  expect(loginRes.body.user).toMatchObject(expectedUser);
});

test("updateUser", async () => {
  const updateUserData = {
    email: "newemail@test.com",
    password: "newpassword",
  };

  // Try updating as a non-admin user with different ID
  const invalidUpdateRes = await request(app)
    .put(`/api/auth/${testAdminUser.id}`)
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send();

  expect(invalidUpdateRes.status).toBe(403);
  expect(invalidUpdateRes.body.message).toBe("unauthorized");

  // Update user as an admin user
  const adminToken = await getAdminToken();
  const adminUpdateRes = await request(app)
    .put(`/api/auth/${testAdminUser.id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send(updateUserData);

  expect(adminUpdateRes.status).toBe(200);
  expect(adminUpdateRes.body.email).toBe(updateUserData.email);
});

test("logout", async () => {
  // Logout with valid token
  const logoutRes = await request(app)
    .delete("/api/auth")
    .set("Authorization", `Bearer ${testUserAuthToken}`);

  expect(logoutRes.status).toBe(200);
  expect(logoutRes.body.message).toBe("logout successful");

  // Try to logout after logout
  const protectedRes = await request(app).delete("/api/auth").send(testUser);

  expect(protectedRes.status).toBe(401);
  expect(protectedRes.body.message).toBe("unauthorized");
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
