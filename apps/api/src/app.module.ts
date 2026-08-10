import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ConnectorsController } from './connectors.controller';
import { OffersController } from './offers.controller';
import { AlertsController } from './alerts.controller';
import { ScheduleController } from './schedule.controller';
import { SettingsController } from './settings.controller';

@Module({
  imports: [],
  controllers: [
    HealthController,
    ConnectorsController,
    OffersController,
    AlertsController,
    ScheduleController,
    SettingsController
  ],
  providers: []
})
export class AppModule {}
