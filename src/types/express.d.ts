import { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: {
        user_id: number;
        userEmail: string;
        userName: string;
      };
    }
  }
}
