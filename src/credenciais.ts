export type Credential = {
  id: string;
  name: string;
  username: string;
  createdAt: string;
};

export type CreateCredentialDto = {
  name: string;
  username: string;
  password: string;
};
