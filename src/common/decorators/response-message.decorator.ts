import { SetMetadata } from '@nestjs/common';

export const RESPONSE_MESSAGE = 'response_message';

// Decorator ResponseMessage message cho từng api
export const ResponseMessage = (message: string) => SetMetadata(RESPONSE_MESSAGE, message);
