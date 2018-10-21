function explodeStr(str, separator, limit)
{
    const array = str.split(separator);
    if (limit !== undefined && array.length >= limit)
    {
        array.push(array.splice(limit - 1).join(separator));
    }
    return array;
}