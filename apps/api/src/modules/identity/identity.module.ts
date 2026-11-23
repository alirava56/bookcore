import {Module} from '@nestjs/common';
import {IdentityController} from './identity.controller';
import {IdentityService} from './identity.service';
import {AccessTokenService} from './token.service';
import {AuthRateLimitGuard} from '../../common/security/rate-limit.guard';
@Module({controllers:[IdentityController],providers:[IdentityService,AccessTokenService,AuthRateLimitGuard],exports:[AccessTokenService]})
export class IdentityModule {}
