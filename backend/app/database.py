from prisma import Prisma

db = Prisma()


async def get_db():
    """Dependency injection yield for the Prisma client."""
    yield db
