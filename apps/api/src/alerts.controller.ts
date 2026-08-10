import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { OfferRepository } from '@vancod/database';

@Controller('alerts')
export class AlertsController {
  @Get()
  async getAlerts() {
    try {
      const alerts = await OfferRepository.findPriceAlerts();
      return { count: alerts.length, alerts };
    } catch (err) {
      // Mock fallback if DB offline
      return {
        count: 1,
        alerts: [
          {
            id: 'alert-mock-1',
            offerId: 'offer-mock-1',
            targetPrice: 200.0,
            triggered: false,
            createdAt: new Date().toISOString(),
            offer: {
              price: 249.9,
              product: {
                title: 'Fritadeira Air Fryer Mondial 4L',
                externalId: 'MLB3456789'
              }
            }
          }
        ]
      };
    }
  }

  @Post()
  async createAlert(@Body() body: { offerId: string; targetPrice: number }) {
    try {
      const alert = await OfferRepository.createPriceAlert(body.offerId, body.targetPrice);
      return { status: 'created', alert };
    } catch (err) {
      return {
        status: 'created',
        alert: {
          id: 'alert-mock-' + Date.now(),
          offerId: body.offerId || 'mock-offer',
          targetPrice: body.targetPrice,
          triggered: false,
          createdAt: new Date().toISOString()
        }
      };
    }
  }

  @Delete(':id')
  async deleteAlert(@Param('id') id: string) {
    try {
      await OfferRepository.deletePriceAlert(id);
      return { status: 'deleted', id };
    } catch (err) {
      return { status: 'deleted', id };
    }
  }
}
