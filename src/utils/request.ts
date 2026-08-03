import { Request } from "express";

export function getParam(req: Request, paramName: string = "id"): string {
  const param = req.params[paramName];

  if (Array.isArray(param)) {
    if (param.length === 0) {
      throw new Error(`Parâmetro ${paramName} não encontrado`);
    }
    return param[0];
  }

  if (typeof param === "string") {
    return param;
  }

  throw new Error(`Parâmetro ${paramName} não encontrado`);
}

export function getParamSafe(req: Request, paramName: string): string | null {
  try {
    return getParam(req, paramName);
  } catch {
    return null;
  }
}

export function getIdParam(req: Request): string {
  return getParam(req, "id");
}

export function getSkuParam(req: Request): string {
  return getParam(req, "sku");
}
