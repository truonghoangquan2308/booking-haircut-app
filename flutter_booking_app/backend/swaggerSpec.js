const swaggerJSDoc = require('swagger-jsdoc');

const PORT = process.env.PORT || 3000;

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Booking Haircut API',
    version: '1.0.0',
    description: 'Swagger UI for booking-haircut-app backend',
  },
  servers: [
    {
      url: `http://localhost:${PORT}`,
    },
  ],
  components: {
    securitySchemes: {
      FirebaseUid: {
        type: 'apiKey',
        in: 'header',
        name: 'x-firebase-uid',
        description: 'Owner/Manager/Admin endpoints require this header',
      },
      ManagerBranchId: {
        type: 'apiKey',
        in: 'header',
        name: 'x-manager-branch-id',
        description: 'Optional for managers to pick which branch',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
    },
  },
  tags: [
    { name: 'Services', description: 'Services' },
    { name: 'Branches', description: 'Branches' },
    { name: 'Barbers', description: 'Barbers / Thợ' },
    { name: 'Timeslots', description: 'Thời gian trống' },
    { name: 'Appointments', description: 'Đặt lịch' },
    { name: 'Reviews', description: 'Đánh giá' },
    { name: 'Owner', description: 'Owner endpoints' },
    { name: 'Manager', description: 'Manager endpoints' },
    { name: 'Admin', description: 'Admin endpoints' },
    { name: 'Users', description: 'Users / xác thực' },
    { name: 'Products', description: 'Sản phẩm / danh mục' },
    { name: 'Offers', description: 'Offers / ưu đãi' },
    { name: 'Shop', description: 'Shop checkout' },
  ],
  paths: {
    '/api/services': {
      get: {
        summary: 'List active services',
        tags: ['Services'],
        responses: {
          200: { description: 'OK' },
          500: { description: 'Server error' },
        },
      },
      post: {
        summary: 'Create service (optionally multipart with image)',
        tags: ['Services'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  price: { type: 'number' },
                  duration: { type: 'integer' },
                  description: { type: 'string' },
                  is_active: { type: 'integer', enum: [0, 1] },
                },
              },
            },
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  price: { type: 'number' },
                  duration: { type: 'integer' },
                  description: { type: 'string' },
                  is_active: { type: 'integer' },
                  image: { type: 'string', format: 'binary' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Created' },
          400: { description: 'Validation error' },
          500: { description: 'Server error' },
        },
      },
    },
    '/api/branches': {
      get: {
        summary: 'List branches',
        tags: ['Branches'],
        responses: { 200: { description: 'OK' }, 500: { description: 'Server error' } },
      },
    },
    '/api/barbers': {
      get: {
        summary: 'List barbers (booking flow)',
        tags: ['Barbers'],
        parameters: [
          {
            name: 'branch_id',
            in: 'query',
            required: false,
            schema: { type: 'integer' },
          },
        ],
        responses: { 200: { description: 'OK' }, 500: { description: 'Server error' } },
      },
      post: {
        summary: 'Create barber (upsert user + barber)',
        tags: ['Barbers'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['full_name', 'phone'],
                properties: {
                  full_name: { type: 'string' },
                  phone: { type: 'string' },
                  bio: { type: 'string' },
                  is_available: { type: 'integer', enum: [0, 1] },
                  branch_id: { type: 'integer', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Created' },
          400: { description: 'Validation error' },
          500: { description: 'Server error' },
        },
      },
    },
    '/api/barbers/by-user/{userId}': {
      get: {
        summary: 'Get barber by user_id',
        tags: ['Barbers'],
        parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' }, 400: { description: 'Validation error' }, 404: { description: 'Not found' }, 500: { description: 'Server error' } },
      },
    },
    '/api/barbers/{barberId}/availability': {
      put: {
        summary: 'Update barber availability',
        tags: ['Barbers'],
        parameters: [{ name: 'barberId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { is_available: { type: 'integer', enum: [0, 1] } }, required: ['is_available'] } } },
        },
        responses: { 200: { description: 'OK' }, 400: { description: 'Validation error' }, 404: { description: 'Not found' }, 500: { description: 'Server error' } },
      },
    },
    '/api/timeslots/{barberId}/{date}': {
      get: {
        summary: 'Get time slots for barber and date',
        tags: ['Timeslots'],
        parameters: [
          { name: 'barberId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'date', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'OK' }, 400: { description: 'Validation error' } },
      },
    },
    '/api/appointments': {
      get: {
        summary: 'List appointments',
        tags: ['Appointments'],
        responses: { 200: { description: 'OK' }, 500: { description: 'Server error' } },
      },
      post: {
        summary: 'Create appointment',
        tags: ['Appointments'],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 201: { description: 'Created' }, 400: { description: 'Validation error' }, 500: { description: 'Server error' } },
      },
    },
    '/api/appointments/customer/{customerId}': {
      get: {
        summary: 'List appointments for a customer',
        tags: ['Appointments'],
        parameters: [{ name: 'customerId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' }, 500: { description: 'Server error' } },
      },
    },
    '/api/appointments/barber/{barberId}': {
      get: {
        summary: 'List appointments for a barber',
        tags: ['Appointments'],
        parameters: [{ name: 'barberId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' }, 500: { description: 'Server error' } },
      },
    },
    '/api/appointments/{appointmentId}/status': {
      put: {
        summary: 'Update appointment status (admin flow)',
        tags: ['Appointments'],
        parameters: [{ name: 'appointmentId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'OK' }, 400: { description: 'Validation error' }, 500: { description: 'Server error' } },
      },
    },
    '/api/admin/appointments': {
      get: {
        summary: 'Admin list appointments (alias)',
        tags: ['Admin'],
        responses: { 200: { description: 'OK' }, 500: { description: 'Server error' } },
      },
    },
    '/api/shop/checkout': {
      post: {
        summary: 'Shop checkout',
        tags: ['Shop'],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'OK' }, 400: { description: 'Validation error' }, 500: { description: 'Server error' } },
      },
    },
    '/api/product-categories': {
      get: {
        summary: 'List product categories',
        tags: ['Products'],
        responses: { 200: { description: 'OK' }, 500: { description: 'Server error' } },
      },
    },
    '/api/products': {
      get: {
        summary: 'List products',
        tags: ['Products'],
        responses: { 200: { description: 'OK' }, 500: { description: 'Server error' } },
      },
    },
    '/api/admin/product-categories': {
      post: {
        summary: 'Create product category',
        tags: ['Admin'],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { type: 'object' } },
          },
        },
        responses: { 201: { description: 'Created' }, 400: { description: 'Validation error' }, 500: { description: 'Server error' } },
      },
    },
    '/api/admin/products': {
      post: {
        summary: 'Create product',
        tags: ['Admin'],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  category_id: { type: 'integer' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  price: { type: 'number' },
                  stock: { type: 'integer' },
                  unit: { type: 'string' },
                  is_active: { type: 'integer' },
                  image: { type: 'array', items: { type: 'string', format: 'binary' } },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Created' }, 400: { description: 'Validation error' }, 500: { description: 'Server error' } },
      },
    },
    '/api/offers': {
      get: {
        summary: 'List offers (public)',
        tags: ['Offers'],
        responses: { 200: { description: 'OK' }, 500: { description: 'Server error' } },
      },
    },
    '/api/reviews': {
      get: {
        summary: 'List reviews',
        tags: ['Reviews'],
        responses: { 200: { description: 'OK' }, 500: { description: 'Server error' } },
      },
      post: {
        summary: 'Create a review',
        tags: ['Reviews'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['appointment_id', 'customer_id', 'barber_id', 'rating'],
                properties: {
                  appointment_id: { type: 'integer' },
                  customer_id: { type: 'integer' },
                  barber_id: { type: 'integer' },
                  rating: { type: 'integer', minimum: 1, maximum: 5 },
                  comment: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Created' }, 400: { description: 'Validation error' }, 500: { description: 'Server error' } },
      },
    },
    '/api/reviews/barber/{barberId}': {
      get: {
        summary: 'List reviews by barber',
        tags: ['Reviews'],
        parameters: [{ name: 'barberId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' }, 400: { description: 'Validation error' }, 500: { description: 'Server error' } },
      },
    },
    '/api/owner/analytics': {
      get: {
        summary: 'Owner analytics',
        tags: ['Owner'],
        security: [{ FirebaseUid: [] }],
        responses: { 200: { description: 'OK' }, 401: { description: 'Missing x-firebase-uid' } },
      },
    },
    '/api/owner/barbers': {
      get: {
        summary: 'Owner list barbers',
        tags: ['Owner'],
        security: [{ FirebaseUid: [] }],
        responses: { 200: { description: 'OK' }, 401: { description: 'Missing x-firebase-uid' } },
      },
      post: {
        summary: 'Owner create barber',
        tags: ['Owner'],
        security: [{ FirebaseUid: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  full_name: { type: 'string' },
                  phone: { type: 'string' },
                  branch_id: { type: 'integer' },
                  bio: { type: 'string' },
                  is_available: { type: 'integer', enum: [0, 1] },
                },
                required: ['full_name', 'phone', 'branch_id'],
              },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 400: { description: 'Validation error' }, 401: { description: 'Missing x-firebase-uid' } },
      },
    },
    '/api/owner/barbers/{barberId}': {
      patch: {
        summary: 'Owner update barber availability/profile',
        tags: ['Owner'],
        security: [{ FirebaseUid: [] }],
        parameters: [{ name: 'barberId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { 200: { description: 'OK' }, 400: { description: 'Validation error' }, 401: { description: 'Missing x-firebase-uid' } },
      },
    },
    '/api/owner/offers': {
      get: { summary: 'Owner list offers', tags: ['Owner'], security: [{ FirebaseUid: [] }], responses: { 200: { description: 'OK' } } },
      post: {
        summary: 'Owner create offer',
        tags: ['Owner'],
        security: [{ FirebaseUid: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'OK' }, 400: { description: 'Validation error' } },
      },
    },
    '/api/owner/offers/{id}': {
      patch: {
        summary: 'Owner update offer',
        tags: ['Owner'],
        security: [{ FirebaseUid: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'OK' }, 400: { description: 'Validation error' } },
      },
      delete: {
        summary: 'Owner delete offer',
        tags: ['Owner'],
        security: [{ FirebaseUid: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' }, 400: { description: 'Validation error' } },
      },
    },
    '/api/manager/branches': {
      get: { summary: 'Manager branches', tags: ['Manager'], security: [{ FirebaseUid: [] }], responses: { 200: { description: 'OK' } } },
    },
    '/api/manager/barbers': {
      get: { summary: 'Manager list barbers', tags: ['Manager'], security: [{ FirebaseUid: [] }], responses: { 200: { description: 'OK' } } },
    },
    '/api/manager/appointments': {
      get: {
        summary: 'Manager list appointments (supports from/to/status)',
        tags: ['Manager'],
        security: [{ FirebaseUid: [] }],
        parameters: [
          { name: 'from', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'to', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'status', in: 'query', required: false, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/api/manager/appointments/{id}/status': {
      patch: {
        summary: 'Manager update appointment status',
        tags: ['Manager'],
        security: [{ FirebaseUid: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' } } } } } },
        responses: { 200: { description: 'OK' }, 400: { description: 'Validation error' } },
      },
    },
    '/api/manager/working-schedules': {
      get: { summary: 'Manager list working schedules', tags: ['Manager'], security: [{ FirebaseUid: [] }], responses: { 200: { description: 'OK' } } },
      post: {
        summary: 'Manager create working schedule',
        tags: ['Manager'],
        security: [{ FirebaseUid: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'OK' }, 400: { description: 'Validation error' } },
      },
    },
    '/api/manager/working-schedules/{id}': {
      delete: {
        summary: 'Manager delete working schedule',
        tags: ['Manager'],
        security: [{ FirebaseUid: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/api/manager/stats': {
      get: { summary: 'Manager stats', tags: ['Manager'], security: [{ FirebaseUid: [] }], responses: { 200: { description: 'OK' } } },
    },
    '/api/manager/shop-orders': {
      get: { summary: 'Manager shop orders', tags: ['Manager'], security: [{ FirebaseUid: [] }], responses: { 200: { description: 'OK' } } },
    },
    '/api/admin/shops': {
      get: {
        summary: 'Admin list shops',
        tags: ['Admin'],
        security: [{ FirebaseUid: [] }],
        responses: { 200: { description: 'OK' }, 401: { description: 'Missing x-firebase-uid' } },
      },
    },
    '/api/admin/platform/stats': {
      get: {
        summary: 'Admin platform stats',
        tags: ['Admin'],
        security: [{ FirebaseUid: [] }],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/api/admin/shops/{id}': {
      patch: {
        summary: 'Admin update shop/branch approval & blocking',
        tags: ['Admin'],
        security: [{ FirebaseUid: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  approval_status: { type: 'string' },
                  is_blocked: { type: 'boolean' },
                  manager_user_id: { type: 'integer', nullable: true },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 400: { description: 'Validation error' }, 500: { description: 'Server error' } },
      },
    },
    '/api/admin/platform/users': {
      get: {
        summary: 'Admin list users (filter/pagination)',
        tags: ['Admin'],
        security: [{ FirebaseUid: [] }],
        parameters: [
          { name: 'role', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'q', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'page', in: 'query', required: false, schema: { type: 'integer' } },
          { name: 'page_size', in: 'query', required: false, schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'OK' }, 500: { description: 'Server error' } },
      },
    },
    '/api/admin/platform/users/{id}': {
      patch: {
        summary: 'Admin update user lock/role',
        tags: ['Admin'],
        security: [{ FirebaseUid: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  is_locked: { type: 'boolean' },
                  role: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 400: { description: 'Validation error' }, 500: { description: 'Server error' } },
      },
    },
    '/api/admin/platform/notifications': {
      get: {
        summary: 'Admin list notifications',
        tags: ['Admin'],
        security: [{ FirebaseUid: [] }],
        parameters: [{ name: 'limit', in: 'query', required: false, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' }, 500: { description: 'Server error' } },
      },
    },
    '/api/admin/platform/audit-log': {
      get: {
        summary: 'Admin list audit logs',
        tags: ['Admin'],
        security: [{ FirebaseUid: [] }],
        parameters: [
          { name: 'page', in: 'query', required: false, schema: { type: 'integer' } },
          { name: 'page_size', in: 'query', required: false, schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'OK' }, 500: { description: 'Server error' } },
      },
    },
    '/api/users/verify': {
      post: {
        summary: 'Upsert user by phone + firebase_uid',
        tags: ['Users'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['phone', 'firebase_uid'],
                properties: {
                  phone: { type: 'string' },
                  firebase_uid: { type: 'string' },
                  role: { type: 'string', default: 'customer' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 400: { description: 'Validation error' }, 500: { description: 'Server error' } },
      },
    },
    '/api/users/by-firebase/{firebaseUid}': {
      get: {
        summary: 'Get user by firebase_uid',
        tags: ['Users'],
        parameters: [{ name: 'firebaseUid', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' }, 400: { description: 'Validation error' }, 404: { description: 'Not found' }, 500: { description: 'Server error' } },
      },
    },
    '/api/users/{phone}': {
      get: {
        summary: 'Get user by phone',
        tags: ['Users'],
        parameters: [{ name: 'phone', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' }, 400: { description: 'Validation error' }, 404: { description: 'Not found' }, 500: { description: 'Server error' } },
      },
    },
    '/api/users': {
      get: {
        summary: 'List users by role',
        tags: ['Users'],
        parameters: [{ name: 'role', in: 'query', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' }, 400: { description: 'Validation error' }, 500: { description: 'Server error' } },
      },
    },
    '/api/admin/users': {
      get: {
        summary: 'Admin alias: list users by role',
        tags: ['Admin'],
        parameters: [{ name: 'role', in: 'query', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' }, 400: { description: 'Validation error' }, 500: { description: 'Server error' } },
      },
    },
    '/api/users/{id}': {
      put: {
        summary: 'Update user profile',
        tags: ['Users'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  full_name: { type: 'string' },
                  avatar_url: { type: 'string' },
                  date_of_birth: { type: 'string' },
                  phone: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 400: { description: 'Validation error' }, 404: { description: 'Not found' }, 500: { description: 'Server error' } },
      },
    },
    '/api/users/{id}/status': {
      put: {
        summary: 'Update user barber status (available/off)',
        tags: ['Users'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['available', 'off'] } } } } },
        },
        responses: { 200: { description: 'OK' }, 400: { description: 'Validation error' }, 404: { description: 'Not found' }, 500: { description: 'Server error' } },
      },
    },
    '/api/users/{id}/avatar': {
      post: {
        summary: 'Upload user avatar',
        tags: ['Users'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: { type: 'object', required: ['avatar'], properties: { avatar: { type: 'string', format: 'binary' } } },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 400: { description: 'Validation error' }, 404: { description: 'Not found' }, 500: { description: 'Server error' } },
      },
    },
  },
};

const swaggerSpec = swaggerJSDoc({
  definition: swaggerDefinition,
  apis: [],
});

module.exports = swaggerSpec;

