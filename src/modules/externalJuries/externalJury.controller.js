// src/modules/externalJuries/externalJury.controller.js
// Capa HTTP del módulo de jurados externos.

import * as service from './externalJury.service.js';

export const invite = async (req, res, next) => {
  try {
    const result = await service.inviteExternalJury(req.body, req.user);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const list = async (req, res, next) => {
  try {
    const result = await service.listExternalJuries(req.query, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const revoke = async (req, res, next) => {
  try {
    const result = await service.revokeExternalJury(
      { inviteId: req.params.inviteId },
      req.user
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
};