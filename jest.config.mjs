import nextJest from "next/jest.js";

// next/jest compiles TypeScript with SWC, so no separate ts-jest/babel setup is needed.
const createJestConfig = nextJest({ dir: "./" });

// Jest runs the unit and integration tests. Vitest runs the component test.
export default createJestConfig({
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/tests/unit/**/*.test.ts", "<rootDir>/src/tests/integration/**/*.test.ts"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
});
