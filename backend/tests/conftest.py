"""
Shared fixtures for all backend tests.
Uses SQLite with UUID strings for portability (no PostgreSQL required).
"""
import pytest
import app.database as _db_module
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from app.database import Base, get_db
from app.main import app

SQLALCHEMY_TEST_URL = "sqlite:///./test.db"

engine = create_engine(SQLALCHEMY_TEST_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Patch the database module so main.py lifespan uses SQLite, not PostgreSQL
_db_module.engine = engine
_db_module.SessionLocal = TestingSessionLocal


@pytest.fixture(scope="function", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def sample_company(db):
    from app.models import Company
    c = Company(name="Test Spirits Co", email="test@spirits.com", delivery_days="Mon, Thu")
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@pytest.fixture
def sample_product(db, sample_company):
    from app.models import Product
    p = Product(
        name="Hennessy VS 750ml",
        sku="HENN-VS-750",
        category="spirits",
        brand="Hennessy",
        unit_size="750ml",
        case_pack=12,
        company_id=sample_company.id,
        reorder_level=2,
        current_stock=5,
        aliases=["henny", "hennessy vs"],
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p
