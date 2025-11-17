// Stub for argon2 in browser - should never be called
export const hash = () => {
  throw new Error('argon2 can only be used server-side')
}

export const verify = () => {
  throw new Error('argon2 can only be used server-side')
}

