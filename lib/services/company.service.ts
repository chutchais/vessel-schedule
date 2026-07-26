import {
  companyRepository,
  type CreateCompanyInput,
} from "@/lib/repositories/company.repository";

export const companyService = {
  async list() {
    return companyRepository.findAll();
  },

  async create(data: CreateCompanyInput) {
    const code = data.code.trim().toUpperCase();

    const existingCompany =
      await companyRepository.findByCode(code);

    if (existingCompany) {
      throw new Error("Company code already exists");
    }

    return companyRepository.create({
      ...data,
      code,
    });
  },
};