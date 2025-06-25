import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { PlanService } from './plan.service';
import { UseGuards, BadRequestException } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { Req } from '@nestjs/common';

@Controller('plans')
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @Get()
  async findAll() {
    return this.planService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.planService.findOne(id);
  }

  @Post(':id/assign')
  async assignPlanToUser(
    @Param('id') planId: string,
    @Body() body: { userId: string }
  ) {
    return this.planService.assignUserToPlan(planId, body.userId);
  }


  @Post('plan-usage')
  @UseGuards(JwtGuard)
  async getPlanUsage(@Req() req: Request) {
    const userId = req['user']?.sub;
    if (!userId) throw new BadRequestException('Usuario no autenticado');
    return this.planService.getPlanUsage(userId);
  }

}
