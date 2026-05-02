import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import authGoogleRouter from "./auth-google.js";
import gameRouter from "./game.js";
import walletRouter from "./wallet.js";
import userRouter from "./user.js";
import adminRouter from "./admin.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(authGoogleRouter);
router.use(gameRouter);
router.use(walletRouter);
router.use(userRouter);
router.use(adminRouter);

export default router;
