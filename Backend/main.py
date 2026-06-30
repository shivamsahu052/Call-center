try:
    from .auth_server import app
except ImportError:
    if __package__:
        raise

    from auth_server import app
