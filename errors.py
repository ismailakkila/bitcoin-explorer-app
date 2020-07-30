from pymongo.errors import ServerSelectionTimeoutError, CursorNotFound
from mongoengine import NotUniqueError

class Error(Exception):
    pass

class DatabaseQueryFailed(Error):
    pass

class ProcessBlockFailed(Error):
    pass

class TorNotAvailable(Error):
    pass
