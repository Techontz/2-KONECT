<?php

namespace App\Exceptions;

use DomainException;

/**
 * An order that cannot be sent to a card gateway at all.
 *
 * Not a gateway failure and not something a shopper can retry their way out
 * of: the total is zero or negative, or it sits below a floor this account
 * cannot charge beneath. Either way no session should be created, and saying
 * "please try again" would be a lie.
 *
 * Deliberately a `DomainException` rather than the SPL `InvalidArgumentException`
 * it began as. Stripe's own library ships
 * {@see \Stripe\Exception\InvalidArgumentException}, which extends the SPL class,
 * so catching that broadly upstream would quietly capture Stripe's parameter
 * errors as well and report a library bug to the shopper as a problem with
 * their order. A type nothing else shares cannot be caught by accident.
 */
class UnchargeableOrder extends DomainException
{
}
