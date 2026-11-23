import {Body,Controller,Get,HttpCode,Post,UseGuards,HttpStatus} from '@nestjs/common';
import {ApiBearerAuth,ApiOperation,ApiTags,ApiResponse} from '@nestjs/swagger';
import {CurrentPrincipal} from '../../common/security/principal';
import {Public} from '../../common/security/authorization';
import type {AuthenticatedPrincipal} from '../../common/security/authorization';
import {AuthRateLimitGuard} from '../../common/security/rate-limit.guard';
import {IdentityService} from './identity.service';
import {LoginDto,RegisterDto,RefreshDto,UserResponseDto,TokensResponseDto,MeResponseDto} from './identity.dto';
@ApiTags('Auth')
@Controller()
export class IdentityController {
 constructor(private readonly identity:IdentityService){}
 @Public() @UseGuards(AuthRateLimitGuard) @Post('auth/register')
 @ApiOperation({summary:'Global user registration'}) @ApiResponse({status:201,type:UserResponseDto})
 register(@Body()body:RegisterDto){return this.identity.register(body);}
 @Public() @UseGuards(AuthRateLimitGuard) @HttpCode(200) @Post('auth/login')
 @ApiResponse({status:200,type:TokensResponseDto})
 login(@Body()body:LoginDto){return this.identity.login(body);}
 @Public() @UseGuards(AuthRateLimitGuard) @HttpCode(200) @Post('auth/refresh')
 @ApiResponse({status:200,type:TokensResponseDto})
 refresh(@Body()body:RefreshDto){return this.identity.refresh(body.refreshToken);}
 @ApiBearerAuth() @HttpCode(HttpStatus.NO_CONTENT) @Post('auth/logout')
 async logout(@CurrentPrincipal()p:AuthenticatedPrincipal){await this.identity.logout(p);}
 @ApiBearerAuth() @Get('me') @ApiResponse({status:200,type:MeResponseDto})
 me(@CurrentPrincipal()p:AuthenticatedPrincipal){return this.identity.me(p);}
}
