<?php

namespace App\Notifications;

use App\Models\TripInvite;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TripInvitation extends Notification
{
    public function __construct(public TripInvite $invite, public string $inviterName) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject($this->inviterName.' invited you to '.$this->invite->trip->name.' on Merrymile')
            ->greeting('You are invited!')
            ->line($this->inviterName.' wants you on the trip "'.$this->invite->trip->name.'".')
            ->action('Join the trip', url('/invites/'.$this->invite->token))
            ->line('This link expires in '.config('merrymile.invite_days').' days.');
    }
}
