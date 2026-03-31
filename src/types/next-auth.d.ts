import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id:              string;
      name?:           string | null;
      email?:          string | null;
      image?:          string | null;
      barbershopId:    string | null;
      barbershopSlug:  string | null;
      role:            string | null;
    };
  }

  interface User {
    id?:    string;
    name?:  string | null;
    email?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?:              string;
    barbershopId?:    string | null;
    barbershopSlug?:  string | null;
    role?:            string | null;
  }
}
