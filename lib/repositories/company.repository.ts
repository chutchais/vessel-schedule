import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type CreateCompanyInput = Prisma.CompanyCreateInput;

export const companyRepository = {
  findAll() {
    return prisma.company.findMany({
      orderBy: {
        name: "asc",
      },
    });
  },

  findByCode(code: string) {
    return prisma.company.findFirst({
      where: {
        code,
      },
    });
  },

  create(data: CreateCompanyInput) {
    return prisma.company.create({
      data,
    });
  },
};