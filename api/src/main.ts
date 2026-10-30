import 'reflect-metadata';
// Carga api/.env antes de construir cualquier modulo: PrismaService necesita
// DATABASE_URL en el momento de instanciarse.
import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Todo cuelga de /api: es el prefijo que consume el frontend de DCredits y el
  // que usa el proxy de desarrollo. Swagger queda fuera del prefijo.
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      // Rechaza campos desconocidos en lugar de ignorarlos en silencio.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    })
  );

  // La API se consume desde Angular: se habilita CORS de origen configurable
  // por entorno, sin credenciales.
  app.enableCors({ origin: process.env['CORS_ORIGIN']?.split(',') ?? true });

  const config = new DocumentBuilder()
    .setTitle('DCredits API')
    .setDescription(
      [
        'Eventos academicos, padron de estudiantes y codigos unicos de participacion.',
        '',
        'Reglas de dominio:',
        '- Los creditos no se almacenan: se derivan de las participaciones VALID.',
        '- verificationCode es unico y se genera una sola vez en el servidor.',
        '- El codigo DC (DC-2026-XXXXXX) es el unico codigo: tambien es el del certificado.',
        '- grade admite null: nunca se convierte en 0.',
        '- Un estudiante no puede registrarse dos veces en el mismo evento.',
      ].join('\n')
    )
    .setVersion('0.1.0')
    .addTag('auth')
    .addTag('users')
    .addTag('students')
    .addTag('events')
    .addTag('participations')
    .build();

  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env['PORT'] ?? 3000);

  await app.listen(port);

  Logger.log(`DCredits API escuchando en http://localhost:${port}/api`, 'Bootstrap');
  Logger.log(`Swagger disponible en http://localhost:${port}/docs`, 'Bootstrap');
}

void bootstrap();
