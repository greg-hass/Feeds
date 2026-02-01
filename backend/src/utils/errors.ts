export class AppError extends Error {
    constructor(
        message: string,
        public code: string,
        public statusCode: number
    ) {
        super(message);
        this.name = 'AppError';
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string) {
        super(`${resource} not found`, 'NOT_FOUND', 404);
        this.name = 'NotFoundError';
    }
}

export class ConflictError extends AppError {
    constructor(message: string) {
        super(message, 'CONFLICT', 409);
        this.name = 'ConflictError';
    }
}

export class ValidationError extends AppError {
    constructor(message: string) {
        super(message, 'VALIDATION_ERROR', 400);
        this.name = 'ValidationError';
    }
}

export class BusinessLogicError extends AppError {
    constructor(message: string) {
        super(message, 'BUSINESS_LOGIC_ERROR', 400);
        this.name = 'BusinessLogicError';
    }
}