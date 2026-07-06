def is_palindrome(s):
    normalized = "".join(ch.lower() for ch in str(s) if ch.isalnum())
    return normalized == normalized[::-1]


def factorial(n):
    if n < 0:
        raise ValueError("factorial is not defined for negative numbers")
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result
