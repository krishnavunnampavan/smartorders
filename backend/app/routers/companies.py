from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Company, Product
from app.schemas.company import CompanyCreate, CompanyUpdate, CompanyOut
from app.schemas.product import ProductOut

router = APIRouter(prefix="/api/companies", tags=["companies"])


@router.get("", response_model=list[CompanyOut])
def list_companies(active_only: bool = True, db: Session = Depends(get_db)):
    q = db.query(Company)
    if active_only:
        q = q.filter_by(is_active=True)
    return q.order_by(Company.name).all()


@router.post("", response_model=CompanyOut, status_code=201)
def create_company(body: CompanyCreate, db: Session = Depends(get_db)):
    company = Company(**body.model_dump())
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.get("/{company_id}", response_model=CompanyOut)
def get_company(company_id: UUID, db: Session = Depends(get_db)):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    return company


@router.put("/{company_id}", response_model=CompanyOut)
def update_company(company_id: UUID, body: CompanyUpdate, db: Session = Depends(get_db)):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(company, k, v)
    db.commit()
    db.refresh(company)
    return company


@router.delete("/{company_id}", status_code=204)
def delete_company(company_id: UUID, db: Session = Depends(get_db)):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    company.is_active = False
    db.commit()


class AssignIn(BaseModel):
    product_ids: list[UUID]


@router.get("/{company_id}/products", response_model=list[ProductOut])
def company_products(company_id: UUID, db: Session = Depends(get_db)):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    return db.query(Product).filter(Product.company_id == company_id, Product.is_active == True).order_by(Product.name).all()


@router.post("/{company_id}/assign", status_code=200)
def assign_products(company_id: UUID, body: AssignIn, db: Session = Depends(get_db)):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    updated = 0
    for pid in body.product_ids:
        p = db.get(Product, pid)
        if p:
            p.company_id = company_id
            updated += 1
    db.commit()
    return {"assigned": updated}


@router.delete("/{company_id}/unassign", status_code=200)
def unassign_products(company_id: UUID, body: AssignIn, db: Session = Depends(get_db)):
    updated = 0
    for pid in body.product_ids:
        p = db.get(Product, pid)
        if p and str(p.company_id) == str(company_id):
            p.company_id = None
            updated += 1
    db.commit()
    return {"unassigned": updated}
