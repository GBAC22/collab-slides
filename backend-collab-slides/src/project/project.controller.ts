import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtGuard)
@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  // Crear un nuevo proyecto
  @Post()
  create(@Body() createProjectDto: CreateProjectDto, @CurrentUser() user: any) {
    return this.projectService.create(createProjectDto, user.userId);
  }

  // Listar proyectos del usuario autenticado
  @Get()
  findAllByUser(@CurrentUser() user: any) {
    return this.projectService.findAllByUser(user.userId);
  }

  // Exportar proyecto a PPTX
  @Post(':id/export')
  async exportPptx(@Param('id') id: string, @CurrentUser() user: any) {
    const fileUrl = await this.projectService.exportToPptx(id, user.userId);
    return { url: fileUrl };
  }

  // Obtener un proyecto por ID
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectService.findOne(id);
  }

  // Actualizar proyecto
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto) {
    return this.projectService.update(id, updateProjectDto);
  }

  // Invitar a un usuario a un proyecto
  @Post(':id/invite')
  inviteUser(@Param('id') id: string, @Body() invite: InviteUserDto) {
    return this.projectService.inviteUser(id, invite);
  }

  // Eliminar un proyecto
  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectService.delete(id, user.userId);
  }
}
