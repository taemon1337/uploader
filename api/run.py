from eve import Eve
from os import getenv

MONGO_HOST = getenv("MONGO_HOST","mongo")
MONGO_PORT = int(getenv("MONGO_PORT", "27017"))
MONGO_DBNAME = getenv("MONGO_DBNAME","uploader-api")

settings = {
  'URL_PREFIX': 'api',
  'RESOURCE_METHODS': ['GET','POST'],
  'MONGO_HOST': MONGO_HOST,
  'MONGO_PORT': MONGO_PORT,
  'MONGO_DBNAME': MONGO_DBNAME,
  'RESOURCE_METHODS': ['GET','POST'],
  'ITEM_METHODS': ['GET','PUT','PATCH'],
  'RETURN_MEDIA_AS_URL': True,
  'RETURN_MEDIA_AS_BASE64_STRING': False,
  'EXTENDED_MEDIA_INFO': ['name','length','content_type'],
  'MEDIA_ENDPOINT': 'raw',
  'XML': False,
  'MULTIPART_FORM_FIELDS_AS_JSON': True,
  'DATE_FORMAT': '%Y-%m-%d %H:%M:%S',
  'DOMAIN': {
    'documents': {
      'schema': {
        'filename': {
          'type': 'string',
          'unique': True,
          'required': True
        },
        'content_type': {
          'type': 'string',
          'required': True
        },
        'file': {
          'type': 'media',
          'required': True
        },
        'origin': {
          'type': 'objectid'
        },
        'reference_id': {
          'type': 'string'
        },
        'message': {
          'type': 'string'
        },
        'upload_at': {
          'type': 'datetime'
        },
        'category': {
          'type': 'string'
        },
        'author': {
          'type': 'string'
        }
      }
    }
  }
}

app = Eve(settings=settings)

if __name__ == "__main__":
  host = getenv("HOST","0.0.0.0")
  port = int(getenv("PORT","8080"))
  debug = getenv("DEBUG",True)
  app.run(host=host, port=port, debug=debug)

