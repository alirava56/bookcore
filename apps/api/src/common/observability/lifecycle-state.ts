import {Injectable,BeforeApplicationShutdown} from '@nestjs/common';
@Injectable()
export class LifecycleState implements BeforeApplicationShutdown {
 private draining=false;
 beforeApplicationShutdown():void{this.draining=true;}
 isDraining():boolean{return this.draining;}
}
