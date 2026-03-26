// Stub for next/headers — not needed in unit tests (requireAdmin is mocked in API tests)
export const cookies = jest.fn().mockResolvedValue({ getAll: () => [] });
