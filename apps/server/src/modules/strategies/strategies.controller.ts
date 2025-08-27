import { Request, Response } from 'express';
import * as strategyService from './strategies.service';

// GET /strategies
export const getStrategies = async (req: Request, res: Response) => {
    const userId = req.user.id; // załóż, że JWT middleware dopina usera
    const strategies = await strategyService.getStrategies(userId);
    res.json(strategies);
};

// GET /strategies/:id
export const getStrategy = async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { id } = req.params;
    const strategy = await strategyService.getStrategyById(id, userId);
    if (!strategy) return res.status(404).json({ message: 'Not found' });
    res.json(strategy);
};

// POST /strategies
export const createStrategy = async (req: Request, res: Response) => {
    const userId = req.user.id;
    const strategy = await strategyService.createStrategy(userId, req.body);
    res.status(201).json(strategy);
};

// PUT /strategies/:id
export const updateStrategy = async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { id } = req.params;
    const strategy = await strategyService.updateStrategy(id, userId, req.body);
    res.json(strategy);
};

// DELETE /strategies/:id
export const deleteStrategy = async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { id } = req.params;
    await strategyService.deleteStrategy(id, userId);
    res.status(204).end();
};
