import { Request, Response } from "express";
import { getIndicators } from "./indicators.service";

export function getIndicatorsController(req: Request, res: Response) {
  res.json(getIndicators());
}