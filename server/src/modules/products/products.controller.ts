import type { Request, Response } from 'express';
import * as service from './products.service';

const perms = (req: Request) => req.user!.permissions;

export function list(req: Request, res: Response): void {
  res.json(service.list(req.db, req.pagination!, perms(req)));
}
export function search(req: Request, res: Response): void {
  res.json({ data: service.search(req.db, String(req.query.q ?? ''), perms(req)) });
}
export function get(req: Request, res: Response): void {
  res.json({ data: service.get(req.db, Number(req.params.id), perms(req)) });
}
export function byBarcode(req: Request, res: Response): void {
  res.json({ data: service.byBarcode(req.db, String(req.params.code), perms(req)) });
}
export function create(req: Request, res: Response): void {
  res.status(201).json({ data: service.create(req.db, req.body, req.user!) });
}
export function update(req: Request, res: Response): void {
  res.json({ data: service.update(req.db, Number(req.params.id), req.body, req.user!) });
}
export function remove(req: Request, res: Response): void {
  res.json({ data: service.remove(req.db, Number(req.params.id), req.user!) });
}
export function setPrice(req: Request, res: Response): void {
  res.json({ data: service.setPrice(req.db, Number(req.params.id), req.body.sale_price_minor, req.user!) });
}
export function addStock(req: Request, res: Response): void {
  res.status(201).json({ data: service.addStock(req.db, Number(req.params.id), req.body, req.user!) });
}
export function addBarcode(req: Request, res: Response): void {
  res.status(201).json({ data: service.addBarcode(req.db, Number(req.params.id), req.body.barcode, req.user!) });
}
export function removeBarcode(req: Request, res: Response): void {
  res.json({ data: service.removeBarcode(req.db, Number(req.params.id), Number(req.params.bid), req.user!) });
}
