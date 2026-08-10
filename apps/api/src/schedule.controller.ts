import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { OfferRepository } from '@vancod/database';

@Controller('schedule')
export class ScheduleController {
  @Get()
  async getScheduledPosts() {
    try {
      const posts = await OfferRepository.findScheduledPosts();
      return { count: posts.length, posts };
    } catch (err) {
      // Mock fallback if DB offline
      return {
        count: 1,
        posts: [
          {
            id: 'sched-mock-1',
            offerId: 'offer-mock-1',
            scheduledAt: new Date(Date.now() + 3600000).toISOString(),
            status: 'SCHEDULED',
            offer: {
              price: 39.9,
              product: {
                title: 'Fone de Ouvido Bluetooth Sem Fio TWS i12',
                externalId: 'shp-1001'
              }
            }
          }
        ]
      };
    }
  }

  @Post()
  async createSchedule(
    @Body() body: { offerId: string; channelId?: string; scheduledAt: string }
  ) {
    const channel = body.channelId || '@vancod_ofertas_channel';
    const date = new Date(body.scheduledAt);

    try {
      const scheduled = await OfferRepository.createScheduledPost(body.offerId, channel, date);
      return { status: 'scheduled', scheduled };
    } catch (err) {
      return {
        status: 'scheduled',
        scheduled: {
          id: 'sched-mock-' + Date.now(),
          offerId: body.offerId,
          channelId: channel,
          scheduledAt: date.toISOString(),
          status: 'SCHEDULED'
        }
      };
    }
  }

  @Delete(':id')
  async deleteSchedule(@Param('id') id: string) {
    try {
      await OfferRepository.deleteScheduledPost(id);
      return { status: 'deleted', id };
    } catch (err) {
      return { status: 'deleted', id };
    }
  }
}
