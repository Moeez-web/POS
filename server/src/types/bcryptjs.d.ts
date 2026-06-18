declare module 'bcryptjs' {
  export function hashSync(data: string, saltOrRounds: string | number): string;
  export function compareSync(data: string, encrypted: string): boolean;
  export function genSaltSync(rounds?: number): string;
  const _default: { hashSync: typeof hashSync; compareSync: typeof compareSync; genSaltSync: typeof genSaltSync };
  export default _default;
}
