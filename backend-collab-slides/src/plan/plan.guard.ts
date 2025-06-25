import { CanActivate, ExecutionContext, Injectable, BadRequestException } from '@nestjs/common';
import { PlanService } from './plan.service';

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(private planService: PlanService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const body = request.body || {};  // ✅ Asegura que no sea undefined

    console.log("✅ PlanGuard: user =", user);
    console.log("✅ PlanGuard: body =", body);

    const userId = user?.userId || user?.id || user?.sub;
    if (!userId) {
      console.warn("⚠ PlanGuard: Usuario no autenticado");
      throw new BadRequestException('Usuario no autenticado');
    }

    // Si body.numSlides o numImages no están definidos, asumimos 1
    const numSlides = typeof body.numSlides === 'number' ? body.numSlides : 5;
    const numImages = typeof body.numImages === 'number' ? body.numImages : numSlides;

    console.log(`✅ PlanGuard: Llamando validateExportRequest con userId=${userId}, slides=${numSlides}, images=${numImages}`);

    await this.planService.validateExportRequest(userId, numSlides, numImages);

    return true;
  }
}
